**What did you use AI for?**

- First, I asked AI to analyze my scenarios I prepared for implementation: whether they were suitable for the assignment, what I had missed, and whether there were any unnecessary checks. Then I used it to write tests in Playwright + TypeScript and integrate Gmail IMAP.
- AI helped analyze test failures. I ran the tests and shared errors when I was unsure of the cause. I analyzed the proposed changes and verified them by running the tests again.
- I also discussed project setup and folder structure with AI. It helped me create the config, constants and utils, and write documentation and code comments. The stack was specified in the assignment.

**Give a concrete example of an AI mistake. How did you discover and fix it?**

- In the nickname test proposed by AI, special characters and spaces were checked consecutively using the same error message. I noticed that the second check could pass because of the remaining message. Between them, I added a valid value and a check that the error disappeared, so that the check for spaces would confirm that it appeared again.

**What did you do independently, or where did you disagree with AI’s suggestion? Why?**

- I prepared the first tests and folder structure myself to show AI how I organize a project and write tests. It then worked from that example. To locate fields, I chose the existing `data-qa` attributes instead of the `getByLabel` proposed by AI, to use a consistent approach with explicit test attributes.
- I explored the application manually: filled out the form, checked errors, received emails, and entered the code. I shared my observations with AI. I also suggested paying attention to the complete successful scenario, rather than only field validation.
- When registering again, I checked the actual email: instead of the expected error on the form, I received an invitation to sign in to the existing account. I also noticed that entering the code through copy/paste produced an error, while entering the same code character by character worked successfully. These observations influenced the checks and the way OTP was entered in the tests. We did not establish the cause of the paste error; it requires further investigation.
