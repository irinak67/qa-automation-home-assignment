# Talkspace signup tests

Take-home assignment: Playwright + TypeScript tests for registration and email verification.

## Setup

```powershell
npm ci
npx playwright install chromium
```

## Run

```powershell
npm test
npm run test:ui
npm run test:headed
npm run typecheck
npm run report
```

Open this folder in VSCode. The Playwright Test extension is optional.

## Current scope and validation

Seven registration tests are implemented in `tests/signup.spec.ts`:

1. Required-field errors after empty submission.
2. Native email validation with the remaining fields valid.
3. Password length boundary: seven to eight characters.
4. Weak repeated password rejected; a stronger example clears the error.
5. Nickname length boundary: one to two characters.
6. Nickname format validation and correction.
7. State visibility when switching between United States and Israel.

Latest verification: all seven tests passed against the canary site in Chromium; TypeScript checking passed. The tests do not intentionally create accounts or request email delivery.

The assignment is not complete: three additional tests require programmatic access to the dedicated test mailbox. See `TEST_PLAN.md` for the proposed final set of ten. No email tests have been added as skipped placeholders or represented as passing.

## Implementation decisions

- Tests use fresh browser contexts and do not depend on execution order.
- Labels are verified against the live DOM. Country and State are custom controls, so they are opened and their options clicked rather than using `selectOption`.
- Browser email validation is checked through `validity.typeMismatch`, avoiding locale-dependent tooltip text.
- Password feedback updates before submission. On a fresh form, nickname validation first appears after submission and then updates as the value is edited.
- Selected-country text has a zero-height DOM wrapper despite being painted on screen. The country test checks the underlying submitted value and the visible dependent State field.

Do not commit credentials, emails, or generated reports/traces containing personal data.
