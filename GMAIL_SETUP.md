# Gmail setup

Use a dedicated test Gmail account.

1. Enable [2-Step Verification](https://myaccount.google.com/security), then create an [app password](https://myaccount.google.com/apppasswords).
2. Copy the template if you do not already have a local `.env`:

   ```powershell
   if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
   ```

3. Fill in the local file:

   ```dotenv
   GMAIL_ADDRESS=your-test-mailbox@gmail.com
   GMAIL_APP_PASSWORD=your-generated-app-password
   GMAIL_MAILBOX=INBOX
   ```

Use the Gmail login address without a `+alias`. The app password is different
from your Gmail sign-in password. `GMAIL_MAILBOX` is optional and defaults to `INBOX`.

Run the email tests with `npm run test:email`. Missing credentials fail the tests.

`config/mail.config.ts` reads and validates these values when an email test
requests its mailbox fixture. Registration-only tests do not require Gmail
credentials. IMAP connection and delivery timeouts are defined in the same
module; Playwright runner settings remain in `playwright.config.ts`.

Each run creates three real canary accounts using aliases delivered to this mailbox.
Account cleanup is not implemented.

Keep credentials in the local `.env`. Do not commit it or generated reports and traces.
