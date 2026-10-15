import { test, expect } from '@playwright/test';
import type { ImapFlow } from 'imapflow';
import { loadMailConfig } from '../../config/mail.config';
import { GmailInbox } from '../clients/gmail-inbox';
import { parseMatchingEmail, signInLink, verificationCode } from '../utils/email-parser';

const config = { ...loadMailConfig({ GMAIL_ADDRESS: 'unit@gmail.com', GMAIL_APP_PASSWORD: 'unit-only' }),
  deliveryTimeoutMs: 40, connectionTimeoutMs: 40, shutdownTimeoutMs: 40 };
const never = () => new Promise<never>(() => {});

for (const operation of ['getMailboxLock', 'noop', 'search', 'fetchOne'] as const) {
  test(`delivery deadline closes a connection stuck in ${operation}`, async () => {
    let closed = false;
    const client = {
      usable: true, on() {}, close() { closed = true; this.usable = false; },
      mailbox: { uidValidity: 1n },
      getMailboxLock: async () => ({ release() {} }), noop: async () => {},
      search: async () => [1], fetchOne: async () => false,
      [operation]: never,
    };
    const inbox = new GmailInbox(config, client as unknown as ImapFlow);
    await expect(inbox.waitForEmail('unit@gmail.com', { uidNext: 1, uidValidity: 1n }, 'verification'))
      .rejects.toThrow('Gmail polling was stopped');
    expect(closed).toBe(true);
  });
}

test('shutdown forcibly closes a hung logout', async () => {
  let closed = false;
  const client = { usable: true, on() {}, logout: never, close() { closed = true; } };
  await new GmailInbox(config, client as unknown as ImapFlow).close();
  expect(closed).toBe(true);
});

test('checkpoint has a finite deadline', async () => {
  let closed = false;
  const client = { usable: true, on() {}, getMailboxLock: never, close() { closed = true; } };
  await expect(new GmailInbox(config, client as unknown as ImapFlow).checkpoint()).rejects.toThrow('checkpoint');
  expect(closed).toBe(true);
});

test('OTP keeps leading zeros and rejects ambiguous emails', () => {
  expect(verificationCode({ subject: '', html: '', text: 'Your code\n001234\n' })).toBe('001234');
  expect(() => verificationCode({ subject: '', html: '', text: '001234\n567890' })).toThrow('unambiguous');
});

test('sign-in parsing ignores data-href and decodes HTML entities', () => {
  expect(signInLink({ subject: '', text: '', html:
    '<a data-href="https://wrong.test">Sign in</a><a href="https://example.test/?a=1&#38;b=2"><b>Sign&nbsp;in</b></a>' }))
    .toBe('https://example.test/?a=1&b=2');
  expect(() => signInLink({ subject: '', text: '', html: '<a data-href="https://wrong.test">Sign in</a>' }))
    .toThrow('does not contain');
});

test('mail parsing matches the complete alias, not a substring', async () => {
  const source = Buffer.from('To: unit+qa123@gmail.com\r\nSubject: Verify your email address\r\n\r\n001234');
  expect(await parseMatchingEmail(source, 'unit+qa12@gmail.com', 'verification')).toBeUndefined();
  expect(await parseMatchingEmail(source, 'unit+qa123@gmail.com', 'verification')).toBeDefined();
});
