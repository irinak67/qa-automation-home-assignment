import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export type MailKind = 'verification' | 'existing-account';
export type ReceivedEmail = { subject: string; text: string; html: string };
export type MailCheckpoint = { uidNext: number; uidValidity: bigint };

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and configure the test mailbox.`);
  return value;
}

export function newSignupIdentity() {
  const base = requiredEnv('GMAIL_ADDRESS');
  const match = /^([^+@\s]+)@(gmail\.com|googlemail\.com)$/i.exec(base);
  if (!match) throw new Error('GMAIL_ADDRESS must be a Gmail address without a +alias.');
  const suffix = randomUUID().replaceAll('-', '');
  return {
    email: `${match[1]}+qa${suffix}@${match[2]}`.toLowerCase(),
    nickname: `Qa${suffix.slice(0, 8)}`,
    password: `Qa!${randomUUID()}7`,
  };
}

// Exact parsed recipients preserve +aliases; IMAP TO searches alone are substring matches.
export async function parseMatchingEmail(
  source: Buffer,
  recipient: string,
  kind: MailKind,
): Promise<ReceivedEmail | undefined> {
  const parsed = await simpleParser(source);
  const to = parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [];
  if (!to.flatMap(address => address.value).some(address => address.address?.toLowerCase() === recipient.toLowerCase())) {
    return undefined;
  }
  const message = { subject: parsed.subject ?? '', text: parsed.text ?? '', html: parsed.html || '' };
  const content = `${message.subject}\n${message.text}`;
  const matchesKind = kind === 'verification'
    ? /Verify your email address/i.test(content)
    : /Sign in to your account/i.test(content) && /already have an account/i.test(content);
  return matchesKind ? message : undefined;
}

export function verificationCode(message: ReceivedEmail): string {
  // The observed template places its six-digit code on a separate line.
  // Avoid picking arbitrary numbers from a footer or a tracking URL.
  const codes = new Set([...message.text.matchAll(/^\s*(\d{6})\s*$/gm)].map(match => match[1]));
  if (codes.size !== 1) throw new Error('Expected one unambiguous six-digit verification code in the fresh email.');
  return [...codes][0];
}

export function signInLink(message: ReceivedEmail): string {
  for (const anchor of message.html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = anchor[3].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^sign in$/i.test(label)) return anchor[2].replace(/&amp;/g, '&');
  }
  throw new Error('The existing-account email does not contain a Sign in link.');
}

export class GmailInbox {
  private readonly client: ImapFlow;
  private readonly folder = process.env.GMAIL_MAILBOX?.trim() || 'INBOX';
  private connectionFailed = false;

  constructor() {
    this.client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: requiredEnv('GMAIL_ADDRESS'),
        pass: requiredEnv('GMAIL_APP_PASSWORD').replace(/\s/g, ''),
      },
      logger: false,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      // UI registration and verification can take longer than 15 seconds between
      // mail operations. Keep automatic IDLE enabled and use ImapFlow's default
      // five-minute inactivity window, separate from initial connection timeouts.
      socketTimeout: 300_000,
    });
    this.client.on('error', () => { this.connectionFailed = true; });
  }

  async connect() {
    try {
      await this.client.connect();
    } catch {
      this.client.close();
      throw new Error('Gmail IMAP connection failed. Check network access, two-step verification, and GMAIL_APP_PASSWORD (not the Gmail login password).');
    }
  }

  async checkpoint(): Promise<MailCheckpoint> {
    if (this.connectionFailed || !this.client.usable) {
      throw new Error('The Gmail IMAP connection was lost before the next mailbox checkpoint. Check network access and IMAP connection lifetime.');
    }
    const lock = await this.client.getMailboxLock(this.folder, { readOnly: true });
    try {
      const status = await this.client.status(this.folder, { uidNext: true, uidValidity: true });
      if (!status || status.uidNext === undefined || status.uidValidity === undefined) {
        throw new Error('IMAP did not provide a mailbox freshness boundary.');
      }
      return { uidNext: status.uidNext, uidValidity: status.uidValidity };
    } finally {
      lock.release();
    }
  }

  async waitForEmail(recipient: string, checkpoint: MailCheckpoint, kind: MailKind): Promise<ReceivedEmail> {
    const deadline = Date.now() + 90_000;
    const inspected = new Set<number>();
    while (Date.now() < deadline) {
      if (this.connectionFailed || !this.client.usable) throw new Error('The Gmail IMAP connection was lost while waiting for email.');
      const lock = await this.client.getMailboxLock(this.folder, { readOnly: true });
      try {
        await this.client.noop();
        const mailbox = this.client.mailbox;
        if (!mailbox || mailbox.uidValidity !== checkpoint.uidValidity) {
          throw new Error('Mailbox UIDVALIDITY changed; refusing to match potentially stale email.');
        }
        const uids = await this.client.search({ uid: `${checkpoint.uidNext}:*`, to: recipient }, { uid: true });
        // IMAP n:* can include the last old message when n exceeds the current maximum UID.
        for (const uid of (uids || []).filter(uid => uid >= checkpoint.uidNext).sort((a, b) => a - b)) {
          if (inspected.has(uid)) continue;
          const fetched = await this.client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!fetched || !fetched.source) continue;
          const message = await parseMatchingEmail(fetched.source, recipient, kind);
          inspected.add(uid);
          if (message) return message;
        }
      } finally {
        lock.release();
      }
      // Bounded delivery polling, not an arbitrary UI sleep.
      await delay(Math.min(2_000, Math.max(0, deadline - Date.now())));
    }
    throw new Error(`No fresh ${kind} email arrived within 90 seconds in GMAIL_MAILBOX. Check the recipient, folder, spam, and application email delivery.`);
  }

  async close() {
    if (!this.client.usable) { this.client.close(); return; }
    await this.client.logout().catch(() => this.client.close());
  }
}
