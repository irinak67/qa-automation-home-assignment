# AI Prompts and Verification Record

Working document; not yet ready for submission.

This record will capture substantive AI interactions that influenced test selection, automation design, email verification, or failure analysis. Routine setup conversations are omitted.

Record prompts as actually submitted. If translated for readability, identify the translation. Do not present a retrospective rewrite as an original prompt.

For each selected interaction, document:

- **Objective and evidence:** The problem being addressed and the observed application behavior or diagnostic evidence supplied to AI.
- **Prompt:** The actual request, including relevant constraints and acceptance criteria.
- **Verification:** How the proposed solution was checked against the application or execution results.
- **Decision and correction:** What was accepted, revised, or rejected, and why.

## Test implementation and verification

**Objective and evidence:** Build registration tests from manual screenshots and observations, then validate their behavior against the live application. The supplied evidence covered required fields, password length and strength, nickname restrictions, country-dependent State visibility, OTP verification, and duplicate-email handling.

**Actual user prompt:**

> Теперь мы готовы к добавлению тестов?

This request continued the preceding investigation; the behavioral evidence was provided in the conversation rather than repeated in a standalone prompt. The screenshots themselves are not committed because they include account details and verification codes.

**Verification:** AI inspected the live labels and custom country/state controls, generated seven tests, and ran them in Chromium. Four passed initially; two nickname tests and the country test failed.

**Correction:** Focused inspection established that nickname validation on a fresh form requires submission, and that the selected country text has a zero-height wrapper. The nickname tests now submit an invalid nickname with the remaining details valid. The country test checks the submitted country value and the visible dependent State field. The corrected suite passed all seven tests.

**Decision:** Email tests remain planned until programmatic mailbox access is configured; no mocks or skipped placeholders are presented as complete end-to-end coverage.
