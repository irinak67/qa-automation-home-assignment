import { test as base } from '@playwright/test';
import { loadMailConfig, type MailConfig } from '../../config/mail.config';
import { GmailInbox } from '../clients/gmail-inbox';

export const emailTest = base.extend<{ mailConfig: MailConfig; inbox: GmailInbox }>({
  mailConfig: async ({}, use) => {
    await use(loadMailConfig());
  },
  inbox: async ({ mailConfig }, use) => {
    const inbox = new GmailInbox(mailConfig);
    try {
      // Authenticate before registration so bad mailbox configuration creates no accounts.
      await inbox.connect();
      await use(inbox);
    } finally {
      await inbox.close();
    }
  },
});
