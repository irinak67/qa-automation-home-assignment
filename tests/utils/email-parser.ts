import { simpleParser } from 'mailparser';
import { parseDocument } from 'htmlparser2';
import { getElementsByTagName, textContent } from 'domutils';

export type MailKind = 'verification' | 'existing-account';
export type ReceivedEmail = { subject: string; text: string; html: string };

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
  const document = parseDocument(message.html);
  for (const anchor of getElementsByTagName('a', document, true)) {
    const label = textContent(anchor).replace(/\s+/g, ' ').trim();
    if (/^sign in$/i.test(label) && anchor.attribs.href) return anchor.attribs.href;
  }
  throw new Error('The existing-account email does not contain a Sign in link.');
}
