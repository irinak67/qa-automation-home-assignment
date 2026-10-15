import { setTimeout as delay } from 'node:timers/promises';
import { ImapFlow } from 'imapflow';
import type { MailConfig } from '../../config/mail.config';
import { parseMatchingEmail, type MailKind, type ReceivedEmail } from '../utils/email-parser';
import { withinDeadline } from '../utils/deadline';

export type MailCheckpoint = { uidNext: number; uidValidity: bigint };

export class GmailInbox {
  private readonly client: ImapFlow;
  private readonly folder: string;
  private connectionFailed = false;

  constructor(private readonly config: MailConfig, client?: ImapFlow) {
    this.folder = config.mailbox;
    this.client = client ?? new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.address,
        pass: config.appPassword,
      },
      logger: false,
      connectionTimeout: config.connectionTimeoutMs,
      greetingTimeout: config.greetingTimeoutMs,
      // UI registration and verification can take longer than 15 seconds between
      // mail operations. Keep automatic IDLE enabled and use ImapFlow's default
      // five-minute inactivity window, separate from initial connection timeouts.
      socketTimeout: config.socketTimeoutMs,
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
    return withinDeadline(
      () => this.readCheckpoint(), this.config.connectionTimeoutMs,
      () => this.abort(), 'Timed out preparing the Gmail mailbox checkpoint.',
    );
  }

  private abort() {
    this.connectionFailed = true;
    this.client.close();
  }

  private async readCheckpoint(): Promise<MailCheckpoint> {
    if (this.connectionFailed || !this.client.usable) {
      throw new Error('The Gmail IMAP connection was lost before the next mailbox checkpoint. Check network access and IMAP connection lifetime.');
    }
    const lock = await this.client.getMailboxLock(this.folder, { readOnly: true });
    try {
      if (this.connectionFailed) throw new Error('Gmail checkpoint was cancelled.');
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
    return withinDeadline(
      () => this.pollForEmail(recipient, checkpoint, kind), this.config.deliveryTimeoutMs,
      () => this.abort(),
      `No fresh ${kind} email arrived within ${this.config.deliveryTimeoutMs / 1_000} seconds. Gmail polling was stopped.`,
    );
  }

  private async pollForEmail(recipient: string, checkpoint: MailCheckpoint, kind: MailKind): Promise<ReceivedEmail> {
    const deadline = Date.now() + this.config.deliveryTimeoutMs;
    const inspected = new Set<number>();
    while (Date.now() < deadline) {
      if (this.connectionFailed || !this.client.usable) throw new Error('The Gmail IMAP connection was lost while waiting for email.');
      const lock = await this.client.getMailboxLock(this.folder, { readOnly: true });
      try {
        if (this.connectionFailed) throw new Error('Gmail polling was cancelled.');
        await this.client.noop();
        const mailbox = this.client.mailbox;
        if (!mailbox || mailbox.uidValidity !== checkpoint.uidValidity) {
          throw new Error('Mailbox UIDVALIDITY changed; refusing to match potentially stale email.');
        }
        const uids = await this.client.search({ uid: `${checkpoint.uidNext}:*`, to: recipient }, { uid: true });
        // IMAP n:* can include the last old message when n exceeds the current maximum UID.
        for (const uid of (uids || []).filter(uid => uid >= checkpoint.uidNext).sort((a, b) => a - b)) {
          if (this.connectionFailed) throw new Error('Gmail polling was cancelled.');
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
      await delay(Math.min(this.config.pollIntervalMs, Math.max(0, deadline - Date.now())));
    }
    throw new Error(`No fresh ${kind} email arrived within ${this.config.deliveryTimeoutMs / 1_000} seconds in GMAIL_MAILBOX. Check the recipient, folder, spam, and application email delivery.`);
  }

  async close() {
    if (!this.client.usable) { this.client.close(); return; }
    await withinDeadline(
      () => this.client.logout(), this.config.shutdownTimeoutMs,
      () => this.abort(), 'Timed out closing Gmail IMAP connection.',
    ).catch(() => this.abort());
  }
}
