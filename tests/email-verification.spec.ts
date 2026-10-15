import { observeAuthResponse } from './clients/auth-response';
import { selectSignupOption } from './pages/signup-form';
import { expect, type Page } from '@playwright/test';
import { AuthEndpoint } from '../constants/auth-endpoints';
import { emailTest } from './fixtures/email.fixture';
import type { GmailInbox } from './clients/gmail-inbox';
import { newSignupIdentity } from './utils/signup-identity';
import { signInLink, verificationCode } from './utils/email-parser';

// Independent tests, run sequentially to limit mailbox connections and email traffic.
emailTest.describe.configure({ mode: 'default', retries: 0, timeout: 180_000 });

const verificationPrompt = (page: Page) => page.getByText('Before matching with a provider, verify your email', { exact: true });
const codeInputs = (page: Page) => page.getByRole('textbox', { name: /^Input verification code [1-6]$/ });

async function fillRegistration(page: Page, identity: ReturnType<typeof newSignupIdentity>) {
  await page.goto('/signup/autoswitchpt', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  await page.getByTestId('emailInput').fill(identity.email);
  await page.getByTestId('createAccountPasswordInput').fill(identity.password);
  await page.getByTestId('nicknameInput').fill(identity.nickname);
  await selectSignupOption(page, 'country', 'Israel');
  await expect(page.getByTestId('stateDropdown')).toBeHidden();
}

async function expectCodeScreen(page: Page, email: string) {
  await expect(verificationPrompt(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`We sent a one-time code to ${email}`, { exact: true })).toBeVisible();
  await expect(codeInputs(page)).toHaveCount(6);
}

async function enterCode(page: Page, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('Verification code must contain exactly six digits.');
  const inputs = codeInputs(page);
  await expect(inputs).toHaveCount(6);
  for (let i = 0; i < 6; i++) await inputs.nth(i).fill('');
  // Fail here, not on an OTP timeout, if the app is still resetting the form.
  for (let i = 0; i < 6; i++) await expect(inputs.nth(i)).toHaveValue('');
  for (let i = 0; i < 6; i++) {
    const input = inputs.nth(i);
    await input.focus();
    await page.keyboard.press(code[i]);
    // The sixth digit submits the code and the fields may disappear.
    if (i < 5) await expect(input).toHaveValue(code[i]);
  }
}

async function submitCode(page: Page, code: string) {
  const otp = observeAuthResponse(page, AuthEndpoint.VerifyEmailCode);
  try {
    await enterCode(page, code);
    return await otp.wait();
  } finally {
    otp.dispose();
  }
}

async function verifyDeliveredCode(page: Page, code: string) {
  const session = observeAuthResponse(page, AuthEndpoint.CreateSession);
  try {
    const response = await submitCode(page, code);
    expect(response.status(), 'The application must accept the delivered OTP').toBe(200);
    const sessionResponse = await session.wait();
    expect(sessionResponse.status()).toBe(200);
  } finally {
    session.dispose();
  }
  await expect(verificationPrompt(page)).toBeHidden();
  // The authenticated shell can transition into the provider introduction.
  // Core verification and session success are asserted above; intake is out of scope.
  const providerIntroduction = page.getByText(/^We[’']re thrilled to introduce you to your provider$/);
  const accountNavigation = page.getByRole('button', { name: /\bAccount$/ });
  await expect(providerIntroduction.or(accountNavigation).filter({ visible: true }).first())
    .toBeVisible({ timeout: 30_000 });
}

async function registerAndReceiveCode(page: Page, inbox: GmailInbox, identity: ReturnType<typeof newSignupIdentity>) {
  await fillRegistration(page, identity);
  const checkpoint = await inbox.checkpoint();
  await page.getByTestId('createAccountSubmitButton').click();
  await expectCodeScreen(page, identity.email);

  const message = await inbox.waitForEmail(identity.email, checkpoint, 'verification');
  return verificationCode(message);
}

emailTest('smoke: a new account verifies its email using the delivered code', async ({ page, inbox, mailConfig }) => {
  const identity = newSignupIdentity(mailConfig.address);
  const code = await registerAndReceiveCode(page, inbox, identity);
  await verifyDeliveredCode(page, code);
});

emailTest('an incorrect code is rejected and the correct delivered code allows recovery', async ({ page, inbox, mailConfig }) => {
  const identity = newSignupIdentity(mailConfig.address);
  const code = await registerAndReceiveCode(page, inbox, identity);
  // Guarantee a different value instead of hoping that a hardcoded 000000 is wrong.
  const incorrectCode = `${(Number(code[0]) + 1) % 10}${code.slice(1)}`;
  const rejectedResponse = await submitCode(page, incorrectCode);
  expect(rejectedResponse.status()).toBe(401);
  await expect(page.getByText('Error validating OTP', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(verificationPrompt(page)).toBeVisible();

  await verifyDeliveredCode(page, code);
});

emailTest('registration with an existing email sends an account sign-in notification', async ({ page, inbox, mailConfig, browser, baseURL }) => {
  emailTest.setTimeout(300_000);
  const identity = newSignupIdentity(mailConfig.address);
  // Prepare a verified account inside this test, without relying on another test's data.
  // The test's own page remains in its untouched, anonymous context.
  const setupContext = await browser.newContext({ baseURL });
  try {
    const setupPage = await setupContext.newPage();
    const code = await registerAndReceiveCode(setupPage, inbox, identity);
    await verifyDeliveredCode(setupPage, code);
  } finally {
    await setupContext.close();
  }

  const email = identity.email;
  await fillRegistration(page, identity);
  const checkpoint = await inbox.checkpoint();
  await page.getByTestId('createAccountSubmitButton').click();

  await expect(verificationPrompt(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`We sent an email with a verification link to ${email}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend email', exact: true })).toBeVisible();
  await expect(codeInputs(page)).toHaveCount(0);

  const message = await inbox.waitForEmail(email, checkpoint, 'existing-account');
  const text = message.text.replace(/\s+/g, ' ');
  expect(text).toContain('Sign in to your account');
  expect(text).toContain('We noticed an attempt to create a new account with your email address.');
  expect(text).toContain('Since you already have an account');
  expect(text.toLowerCase()).toContain(email);
  expect(new URL(signInLink(message)).protocol).toBe('https:');
  expect(new URL(signInLink(message)).origin).toBe(new URL(baseURL!).origin);

});
