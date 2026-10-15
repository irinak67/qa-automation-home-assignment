# Signup and email verification tests

Playwright + TypeScript automation for the Talkspace canary signup flow at
[app.canary.talkspace.com/signup/autoswitchpt](https://app.canary.talkspace.com/signup/autoswitchpt).

The suite contains **10 browser tests**: seven registration-form checks and three
scenarios that use real email delivery. Tests run against the deployed application;
application source code and backend administration are outside this repository.
Application API responses and email deliveries are not mocked.

## Contents

- [Scope and test selection](#scope-and-test-selection)
- [Requirements and installation](#requirements-and-installation)
- [Gmail configuration](#gmail-configuration)
- [Running the tests](#running-the-tests)
- [Test scenarios](#test-scenarios)
- [Project structure](#project-structure)
- [Configuration and timeouts](#configuration-and-timeouts)
- [How email verification works](#how-email-verification-works)
- [Locators and assertions](#locators-and-assertions)
- [Reports and troubleshooting](#reports-and-troubleshooting)
- [Limitations and validation status](#limitations-and-validation-status)

## Scope and test selection

The main business risk is that a user cannot create and verify an account. The
email scenarios cover successful verification after resending a code, recovery
from an incorrect code, and the notification sent when an email is already registered.

Form checks cover required fields, invalid email format, password length and
strength, nickname boundaries and format, and the country-dependent state field.
Boundary cases are grouped within scenarios to keep the suite at ten tests.

All checks exercise the browser UI. There is no unit-test suite or Page Object
layer. Shared functions handle repeated UI actions, data generation, mail parsing,
and network observation. Provider matching, intake, password reset, exhaustive
input combinations, and other browser engines are outside the scope.

## Requirements and installation

- Node.js **20 or later**, as declared in `package.json`, and npm.
- Access to the canary application and its APIs.
- Playwright Chromium, installed separately from npm dependencies.
- For email tests: a dedicated Gmail account with an app password and network
  access to `imap.gmail.com:993` over TLS.

The seven form tests do not require Gmail credentials, but still require the live
application and its normal page-loading requests.

Open a terminal in the repository root and install the locked dependencies:

```powershell
npm ci
```

Install the configured browser:

```powershell
npx playwright install chromium
```

There is no local application server to start. Tests use the deployed URL from
`config/test.config.ts`. Check TypeScript and confirm test discovery:

```powershell
npm run typecheck
npm test -- --list
```

The listing should show **10 tests in 2 files** under the `chromium` project.
Listing tests does not execute them or verify that the services are available.

## Gmail configuration

Use a dedicated test mailbox. Enable Google two-step verification and create a
Google app password. Use that app password, not the regular Gmail login password.
See [GMAIL_SETUP.md](GMAIL_SETUP.md) for setup links and instructions.

Create a local `.env` without overwriting an existing file:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
```

Fill in the local values:

```dotenv
GMAIL_ADDRESS=your-test-mailbox@gmail.com
GMAIL_APP_PASSWORD=your-generated-app-password
GMAIL_MAILBOX=INBOX
```

| Variable | Required | Meaning |
| --- | --- | --- |
| `GMAIL_ADDRESS` | For email tests | Base `gmail.com` or `googlemail.com` address without a `+alias`. |
| `GMAIL_APP_PASSWORD` | For email tests | App password for IMAP authentication. Whitespace is removed during loading. |
| `GMAIL_MAILBOX` | No | IMAP folder to inspect; defaults to `INBOX`. |

The email fixture validates configuration and connects before registration.
Missing credentials fail an email test rather than silently skipping it.
Gmail settings are validated only when the email fixture is used.

Each email test generates a unique address such as
`your-test-mailbox+qa<random-id>@gmail.com`. These aliases deliver to the same
mailbox; they are not separate Gmail accounts. Nicknames and signup passwords are
also generated per identity.

Only the configured folder is searched. The default `INBOX` does not search Spam
or other folders. Check where messages are delivered when diagnosing missing email.

### Credentials and generated data

`.env`, reports, and test results are excluded by `.gitignore`. A local `.env`
file is not encrypted; keep it private. For CI, supply Gmail variables through
the CI secret store. This repository does not include a CI workflow.

Traces and screenshots can contain email addresses, OTPs, and authentication data.
Inspect and redact them before sharing.

A complete successful email-suite run creates **three real canary accounts** and
expects five email deliveries: two for resend, one for incorrect-code recovery,
and two for the existing-email scenario. Failed and repeated runs may leave
additional accounts. Account cleanup is not implemented.

## Running the tests

Run commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm test` | Run all ten tests; requires Gmail configuration. |
| `npm run test:registration` | Run the seven form-validation tests. |
| `npm run test:email` | Run the three real-email scenarios. |
| `npm run test:headed` | Run the suite with a visible browser. |
| `npm run test:ui` | Open Playwright UI mode. |
| `npm run typecheck` | Check TypeScript without emitting JavaScript. |
| `npm test -- --list` | List tests without executing them. |
| `npm run report` | Open the CLI HTML report. |
| `npm run report:ui` | Open the UI-mode HTML report, when generated. |
| `npm run report:vscode` | Open the VS Code HTML report, when generated. |

Run one scenario by its title, for example:

```powershell
npm run test:email -- --grep "an incorrect code"
```

The configured browser project is Chromium with Desktop Chrome device settings.
A single worker limits concurrent browser and mailbox activity within one run.
Separate CLI, UI, and VS Code runs can still overlap; avoid overlapping email runs
when investigating instability.

Local retries default to zero. CI retries default to one, but the email test file
explicitly sets retries to zero. No test relies on another test having run first.

## Test scenarios

The descriptions below reflect the current code, including setup, assertions,
and the limits of what each scenario establishes.

### Registration form: shared setup

File: [tests/signup.spec.ts](tests/signup.spec.ts).

Before each test, open the signup page, wait for the `Create your account`
heading, and select United States. Playwright provides a fresh browser context
for each test. Selecting United States makes the state field available.

### 1. Required fields on an empty form

**Title:** `submitting an empty registration form displays required-field errors`

- **Setup:** Leave email, password, nickname, and state empty after shared setup.
- **Action:** Click the create-account button.
- **Expected:** Specific required-field messages appear for email, password,
  nickname, and state. The signup heading remains visible.
- **Purpose:** Check actionable feedback for missing required input.

### 2. Email without an @ character

**Title:** `email without @ blocks submission when the other fields are valid`

- **Setup:** Enter `qa-example.com`, a valid test password, `QaTester`, and Alabama.
  Observe POST requests to the configured client API host and native `invalid`
  events on the email input.
- **Action:** Click the create-account button.
- **Expected:** The input has `typeMismatch: true` and `valid: false`, receives
  focus and one invalid event. No POST request to the observed API host is
  recorded during the checked interaction. The signup heading remains visible.
- **Purpose:** Verify native email validation without relying on a localized
  browser message. The observer covers all POSTs to that host, not just registration.

### 3. Password minimum length

**Title:** `password minimum-length error appears before submission and clears at eight characters`

- **Action:** Enter `m62i67v` (seven characters), then `m62i67v8` (eight).
- **Expected:** The minimum-eight-character error appears for seven characters
  and disappears for eight without submitting the form.
- **Purpose:** Check both sides of the minimum-length boundary. Clearing the
  length error alone does not establish password strength or successful signup.

### 4. Password strength

**Title:** `eight repeated digits fail password strength validation and a stronger value clears the error`

- **Action:** Enter `11111111`, then the shared stronger test password.
- **Expected:** Repeated digits produce the security message and `Strength: Weak`.
  The stronger value clears that message and produces `Strength: Strong`.
- **Purpose:** Check that minimum length alone does not satisfy the strength rule.

### 5. Nickname length boundaries

**Title:** `nickname enforces its minimum and maximum length boundaries`

- **Setup:** Fill the other required fields with valid test values.
- **Action:** Enter `a` and submit to activate validation. Change it to `a1`, then
  try `Qa123456789` (11 characters) and `Qa12345678` (10 characters).
- **Expected:** One character produces the minimum-length error; two clear it
  without first-character or format errors. Eleven characters produce the
  maximum-length error; ten clear it.
- **Purpose:** Check the 1/2 and 10/11 boundaries. The final valid values are not
  submitted to create an account.

### 6. Nickname format

**Title:** `nickname rejects a numeric first character, special characters, and spaces`

- **Setup:** Fill the other required fields with valid test values.
- **Action:** Submit `123`, then enter `!!!!!`, `QaTester`, `qa tester`, and finally
  `QaTester` again.
- **Expected:** A numeric first character produces the first-character error.
  Special characters and spaces produce the format error. Valid input clears
  the first-character and format errors at the checked recovery points.
- **Purpose:** Check rejection and recovery after correcting nickname input.

### 7. Country-dependent state field

**Title:** `state is displayed for United States and hidden for Israel`

- **Setup:** Start with United States and choose Alabama.
- **Action:** Switch to Israel, then back to United States.
- **Expected:** The underlying country input changes from `US` to `IL` and back.
  The state control is visible for United States, hidden for Israel, and visible
  again after switching back. The initial selected state input is non-empty.
- **Purpose:** Check the conditional field. The test does not assert whether the
  previous state selection is retained or cleared after changing countries.

### Email verification: shared setup

File: [tests/email-verification.spec.ts](tests/email-verification.spec.ts).

The email fixture loads Gmail configuration and authenticates over IMAP. Each
scenario generates its own identity, fills the form, and selects Israel, where
no state selection is required. Before submitting registration, it records a
mailbox checkpoint. It then waits for the verification screen and a fresh email
addressed to that exact alias.

### 8. Successful verification with a resent code

**Title:** `a new account verifies its email using the resent code`

- **Setup:** Register a new account and receive its first verification email.
- **Action:** Take a new checkpoint, click `Resend code`, wait for the next
  verification email, and enter the code from that email.
- **Expected:** Resend returns `200`; the code screen remains available. The next
  email is newer than the resend checkpoint. OTP verification and session creation
  both return `200`; the prompt disappears and either account navigation or the
  provider introduction becomes visible.
- **Purpose:** Cover successful verification and repeat delivery together. The
  test does not assert that the second code differs or that the first is invalidated.
- **Budget:** 300 seconds overall, with up to 90 seconds for each delivery.

### 9. Incorrect code followed by recovery

**Title:** `an incorrect code is rejected and the correct delivered code allows recovery`

- **Setup:** Register a new account and obtain its delivered code.
- **Action:** Change the first digit to guarantee a different six-digit value.
  Submit it, then enter the original code after the rejection is displayed.
- **Expected:** The wrong code returns `401`, displays `Error validating OTP`,
  and leaves the verification prompt visible. The correct code then returns
  `200`, session creation returns `200`, and the authenticated UI appears.
- **Purpose:** Check rejection and recovery without restarting registration.
- **Budget:** 180 seconds overall, including up to 90 seconds for delivery.

### 10. Registration with an existing email

**Title:** `registration with an existing email sends an account sign-in notification`

- **Setup:** Create and verify a new account in a separate browser context, then
  close it. The main test page stays unauthenticated. This preparation includes
  one email delivery and successful OTP/session requests.
- **Action:** Submit registration with the same identity on the main page. Take
  a new mailbox checkpoint before submission.
- **Expected UI:** The page says it sent an email with a verification link, shows
  `Resend email`, and has no six-digit OTP inputs.
- **Expected email:** A fresh existing-account notification arrives. Its normalized
  text contains the sign-in heading, the attempted-registration explanation, the
  existing-account explanation, and the recipient address. Its `Sign in` link
  uses HTTPS and the same origin as the application base URL.
- **Purpose:** Check guidance for an already registered user. The link is inspected,
  not opened; `Resend email` is checked for visibility, not clicked.
- **Budget:** 300 seconds, including preparation and two delivery waits. A setup
  failure prevents the actual repeated-registration checks from being reached.

## Project structure

```text
config/
  mail.config.ts              Gmail defaults and credential validation
  test.config.ts              Application settings and named waiting budgets
constants/
  auth-endpoints.ts           OTP, resend, and session API paths
tests/
  signup.spec.ts              Seven registration-form checks
  email-verification.spec.ts  Three real-email scenarios
  clients/
    auth-response.ts         Observe auth responses and request failures
    gmail-inbox.ts           Stateful IMAP connection and delivery polling
  fixtures/
    email.fixture.ts         Gmail setup and connection cleanup per test
  utils/
    deadline.ts              Bound async operations and invoke timeout cleanup
    email-parser.ts          Match mail, extract OTPs and the sign-in link
    signup-form.ts           Select country/state dropdown options
    signup-identity.ts       Generate a unique alias, nickname, and password
.env.example                 Placeholder Gmail configuration
.gitignore                   Exclude local secrets and generated artifacts
CLAUDE.md                    Rules for assistant work in this repository
GMAIL_SETUP.md               Dedicated mailbox setup guide
package.json                 Scripts and development dependencies
package-lock.json            Locked dependency versions for npm ci
playwright.config.ts         Browser, runner, reporters, artifact settings
tsconfig.json                Strict TypeScript checking; no emitted files
README.md                    Setup, scenarios, implementation, limitations
```

`GmailInbox` is a class because it owns a connection and lifecycle state. Other
helpers are functions. The fixture closes the connection after a test, including
on failure; it does not delete application accounts.

Dependencies serve specific purposes: Playwright runs browser tests, TypeScript
and Node types provide checking, dotenv loads local settings, ImapFlow reads
IMAP, mailparser parses MIME messages, and htmlparser2/domutils extract the HTML
sign-in link. Exact resolved versions are recorded in the lockfile.

## Configuration and timeouts

[config/test.config.ts](config/test.config.ts) holds the application base URL,
API hostname, signup path, `data-qa` attribute, and waiting budgets. When changing
environments, review both the base URL and API hostname so request observation
continues to match the application.

| Setting | Value | Purpose |
| --- | --- | --- |
| `signupReadyMs` | 20 seconds | Signup heading in form-test setup. |
| `verificationPromptMs` | 20 seconds | Verification prompt after registration. |
| `authResponseMs` | 20 seconds | Default wait for an observed auth result. |
| `otpErrorMs` | 10 seconds | Incorrect-OTP error message. |
| `authenticatedShellMs` | 30 seconds | Account navigation or provider introduction. |
| `emailScenarioMs` | 180 seconds | Default email-scenario budget. |
| `twoDeliveryScenarioMs` | 300 seconds | Resend and existing-email scenarios. |

The email registration helper's heading assertion currently uses Playwright's
default assertion timeout, not `signupReadyMs`. Assertions without an explicit
timeout use runner defaults. An operation's timeout does not extend the total
test budget.

Mail defaults are in [config/mail.config.ts](config/mail.config.ts):

| Setting | Value | Purpose |
| --- | --- | --- |
| Host / port / secure | `imap.gmail.com` / `993` / `true` | Gmail IMAP over TLS. |
| `connectionTimeoutMs` | 15 seconds | Initial connection and checkpoint budget. |
| `greetingTimeoutMs` | 15 seconds | Initial IMAP greeting. |
| `socketTimeoutMs` | 300 seconds | Socket inactivity limit between mail operations. |
| `deliveryTimeoutMs` | 90 seconds | Maximum wait per fresh matching email. |
| `pollIntervalMs` | 2 seconds | Delay between polls, limited by remaining time. |
| `shutdownTimeoutMs` | 5 seconds | Logout budget before forced connection closure. |

Budgets are named by purpose so unrelated waits can change independently.
Increasing them does not resolve a browser CORS rejection.

## How email verification works

1. **Checkpoint:** Before triggering an email, read the folder's `UIDNEXT` and
   `UIDVALIDITY`. UIDNEXT marks the next message UID; UIDVALIDITY identifies the
   folder's UID generation.
2. **Search:** Poll candidate UIDs for the recipient. Explicitly discard older
   UIDs because an IMAP `n:*` range can include the last old message when `n`
   exceeds the current maximum UID.
3. **Match:** Parse each candidate and compare the complete recipient, including
   the alias. IMAP recipient search alone can match a substring. Identify the
   requested email kind using the observed English template text.
4. **Extract:** Read one distinct six-digit OTP on its own text line, preserving
   leading zeros. For sign-in mail, parse HTML and find an anchor labeled `Sign in`.
5. **Bound the wait:** On delivery timeout, close the IMAP connection.
   `withinDeadline` calls its cleanup callback; `Promise.race` alone does not
   cancel the underlying network operation.

Changed UIDVALIDITY causes a failure rather than accepting potentially stale
mail. Already inspected candidates are not repeatedly parsed during one wait.
Mailbox access uses a read-only lock and does not delete messages.

`observeAuthResponse` subscribes before the UI action and retains the first
matching POST response or request failure, even if it arrives before `wait()`.
Matching uses method and URL path. Observers are removed in `finally` blocks.

OTP entry clears all six fields and checks that they are empty before entering
digits individually. The sixth digit submits the code, so the test does not
assert its value in a field that may already have disappeared.

## Locators and assertions

- Main form controls use existing `data-qa` attributes via `getByTestId`.
- Buttons and headings use roles and accessible names; OTP fields use their
  accessible textbox names.
- Validation messages use exact text to identify the expected error.
- The custom country/state control uses a scoped option-ID pattern and exact
  text because the observed options lack listbox/option roles.
- Country/state values are also checked through their underlying inputs.
- Native invalid-email behavior is inspected through input validity instead of
  a localized browser message. UI assertions wait for observable states.

The suite depends on the observed English UI and email templates. Changes to
copy, accessible names, test attributes, or dropdown markup may require updates.

## Reports and troubleshooting

The runner prints a list report and writes HTML output. Traces are retained on
failure; screenshots are captured only on failure.

| Runner | Test artifacts | HTML report |
| --- | --- | --- |
| CLI | `test-results/cli` | `playwright-report/cli` |
| UI mode | `test-results/ui` | `playwright-report/ui` |
| VS Code test server | `test-results/vscode` | `playwright-report/vscode` |

The configuration selects directories from runner arguments to keep modes from
clearing each other's artifacts. Later runs in the same mode can replace previous
output; preserve a useful failing trace locally before rerunning.

Open the relevant HTML report and inspect the failing action, screenshot, console,
and network requests in its trace. Error text alone may not explain the cause.

| Symptom | What to inspect |
| --- | --- |
| Browser executable missing | Run the separate Chromium installation command. |
| Missing email configuration | Check required variable names and non-empty values. |
| Gmail connection failure | Check the app password and IMAP network access. |
| No fresh email | Check the alias, selected folder, Spam, and actual delivery. |
| OTP parsing error | Check that the template still has one six-digit code on its own line. |
| `net::ERR_FAILED` on OTP | Inspect console and network evidence; this error alone does not prove CORS. |
| No session response | First establish whether OTP verification succeeded. |
| Existing-email test failure | Distinguish account preparation from repeated registration. |
| Field assertion failure | Inspect the UI and locator before increasing timeouts. |

## Limitations and validation status

- Tests depend on live canary services and Gmail delivery.
- Delivery exceeding 90 seconds, or mail outside the selected folder, causes failure.
- Created accounts are not cleaned up. There is no automatic IMAP reconnect within
  a failing scenario.
- Only Chromium and the observed English UI/templates are covered.
- Successful first-code verification is exercised during existing-email setup;
  the separately named success scenario uses resend.
- OTP expiry, old-code invalidation, rate limiting, opening the sign-in link, and
  resending the existing-account notification are not covered.

Validation recorded during the 2026-10-15 refactoring:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed after removal of the unit suite. |
| `npm test -- --list` | Discovered ten Chromium tests in two files. |
| Fresh full E2E run after refactoring | Passed: 10/10 tests in VS Code, approximately 129 seconds. |
| Clean `npm ci` installation | Verified after cloning on another computer. Additional packages were installed later. |

The assignment's AI-use reflection and representative prompt are separate
submission items and are not included in this README.
