# Talkspace signup tests

Playwright + TypeScript tests for registration and email verification at
https://app.canary.talkspace.com/signup/autoswitchpt.

## Setup

```powershell
npm ci
npx playwright install chromium
```

The three email tests also require local Gmail configuration; see [GMAIL_SETUP.md](GMAIL_SETUP.md).
The seven registration tests run without mailbox credentials.

## Run

```powershell
npm run typecheck
npm run test:registration
npm run test:email
npm test -- --workers=1
npm run test:ui
npm run report
```

## Code organization

- `config/`: environment validation and mailbox settings.
- `constants/`: named application API paths.
- `tests/fixtures/`: Playwright setup and teardown; creates the mailbox client per test.
- `tests/clients/`: IMAP connection, mailbox checkpoints, and delivery polling.
- `tests/utils/`: email parsing and signup data generation; no Playwright or environment access.
- `tests/*.spec.ts`: scenarios, UI actions, and assertions.

The email fixture supplies configuration to the client. The client uses the email
parser; utilities never import clients or fixtures. Email content types live with
the parser, while the IMAP checkpoint type lives with the client.

## Scope and review status

- 10 Chromium tests: 7 registration-validation tests and 3 real-email scenarios.
- Email scenarios cover successful verification, incorrect-code recovery, and registration with an existing email.
- Each email scenario prepares its own account using a unique Gmail alias.
- Provider matching and intake are outside scope.

Latest local validation (2026-10-14): TypeScript checking passed; all seven
registration tests and all three email tests passed in separate runs with one
worker. Later runs reproduced a failure during existing-email account preparation:
the browser blocked the OTP request because its CORS preflight response lacked
`Access-Control-Allow-Origin`. The session request then did not occur. This
environment failure remains unresolved; the test now reports OTP transport
failures directly rather than only reporting the subsequent session timeout.
An earlier missing-email failure also did not reproduce; its cause remains
unconfirmed. Tests default to one worker to limit browser and mailbox contention.

AI prompts and reflection will be added before final submission.
