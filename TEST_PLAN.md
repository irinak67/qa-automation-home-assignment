# Signup and Email Verification Test Plan

| # | Scenario | Current status |
|---|---|---|
| 1 | Register with a unique email, retrieve the fresh six-digit code, enter it sequentially, and reach the next stable application screen | Planned; mailbox access required |
| 2 | Submit an empty form and see required email, password, nickname, and state errors | Implemented and passed |
| 3 | Submit an email without @ with all other details valid; native validation blocks progression | Implemented and passed |
| 4 | Check the seven/eight-character password length boundary without assuming length alone establishes strength | Implemented and passed |
| 5 | Reject eight repeated digits and clear the strength error with an observed stronger example | Implemented and passed |
| 6 | Reject a one-character nickname and clear validation with a letter followed by a digit | Implemented and passed |
| 7 | Reject nickname values beginning with a digit or containing special characters or spaces; clear errors after correction | Implemented and passed |
| 8 | Show State for United States, hide it for Israel, and show it again on return | Implemented and passed |
| 9 | Reject a deliberately incorrect six-digit code, remain on verification, then recover with the fresh code from the same registration | Planned; mailbox access required; invalid-code behavior must be verified live |
| 10 | Submit an existing account's email, display the email-link screen, and receive a new sign-in notification explaining that the account already exists | Planned; existing test account and mailbox access required |

## Email test prerequisites

- A programmatic mailbox connection; secrets must be stored locally and excluded from Git.
- Fresh addresses for new-account tests. Gmail plus addressing is a candidate, but the application's handling must be verified before relying on it.
- Match messages to the exact test recipient and a freshness boundary; never take an arbitrary latest message from a shared inbox.
- Bounded polling for delivery and extraction of the code from the message body.
- An existing verified test account for the duplicate-email scenario, independent of smoke-test execution.
- A stable post-verification UI assertion. The observed provider-introduction screen is a candidate; the transient Welcome/loading screen should not be the completion assertion.

## Exploration findings

Manual exploration found that pasting a code produced `Error validating OTP`, while sequential manual entry of the same code succeeded. This is a potential paste-handling defect; clipboard contents, timing, and reproduction still require investigation. It does not establish that arbitrary wrong codes always produce the same error.

The received verification email states that codes expire after ten minutes and also contains a verification link. Expiry, resend, update-email, and link-based verification are outside the proposed initial ten-test scope.

For an existing email, the UI presented a verification-link message, while the actual email explained the existing account and offered Sign in. The test will validate those observed UI and email outcomes; it will not claim to prove database-level uniqueness.
