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

## Scope and review status

- 10 Chromium tests: 7 registration-validation tests and 3 real-email scenarios.
- Email scenarios cover successful verification, incorrect-code recovery, and registration with an existing email.
- Each email scenario prepares its own account using a unique Gmail alias.
- Provider matching and intake are outside scope.

Latest reported run: TypeScript checking passed. The existing-email test timed out
waiting for `/v2/auth/tlt` during account preparation; the cause is not yet established.

AI prompts and reflection will be added before final submission.
