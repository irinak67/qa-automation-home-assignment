import { test, expect, type Page } from '@playwright/test';

async function fillValidDetailsExceptNickname(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('qa.signup@example.com');
  await page.getByLabel('Password', { exact: true }).fill('123456789asdfqe8');
  await page.getByLabel('State', { exact: true }).click();
  await page.getByText('Alabama', { exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/signup/autoswitchpt');
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
});

test('submitting an empty registration form displays required-field errors', async ({ page }) => {
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Please enter an email.', { exact: true })).toBeVisible();
  await expect(page.getByText('Please enter a password.', { exact: true })).toBeVisible();
  await expect(page.getByText('Please enter a nickname.', { exact: true })).toBeVisible();
  await expect(page.getByText('Please select a state.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
});

test('email without @ blocks submission when the other fields are valid', async ({ page }) => {
  const email = page.getByLabel('Email', { exact: true });
  await email.fill('qa-example.com');
  await page.getByLabel('Password', { exact: true }).fill('123456789asdfqe8');
  await page.getByLabel('Nickname', { exact: true }).fill('QaTester');
  await page.getByLabel('State', { exact: true }).click();
  await page.getByText('Alabama', { exact: true }).click();

  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // Browser validation messages depend on locale; inspect the native validity state.
  await expect.poll(() => email.evaluate((element: HTMLInputElement) => ({
    typeMismatch: element.validity.typeMismatch,
    valid: element.validity.valid,
  }))).toEqual({ typeMismatch: true, valid: false });
  await expect(email).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
});

test('password minimum-length error appears before submission and clears at eight characters', async ({ page }) => {
  const password = page.getByLabel('Password', { exact: true });
  const error = page.getByText('Password must be at least 8 characters.', { exact: true });

  await password.fill('m62i67v');
  await expect(error).toBeVisible();
  await password.fill('m62i67v8');
  await expect(error).toBeHidden();
  // Clearing the length error does not prove that the strength requirement is met.
});

test('eight repeated digits fail password strength validation and a stronger value clears the error', async ({ page }) => {
  const password = page.getByLabel('Password', { exact: true });
  const error = page.getByText("Password not secure enough. Try adding symbols or words, and don't use repeat characters.", { exact: true });

  await password.fill('11111111');
  await expect(error).toBeVisible();
  await expect(page.getByText('Strength: Weak', { exact: true })).toBeVisible();

  await password.fill('123456789asdfqe8');
  await expect(error).toBeHidden();
  await expect(page.getByText('Strength: Strong', { exact: true })).toBeVisible();
});

test('nickname enforces its minimum and maximum length boundaries', async ({ page }) => {
  const nickname = page.getByLabel('Nickname', { exact: true });
  const error = page.getByText('Must be at least 2 characters.', { exact: true });

  await fillValidDetailsExceptNickname(page);
  await nickname.fill('a');
  // On a fresh form nickname errors first appear after submission, not on fill or blur.
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(error).toBeVisible();
  await nickname.fill('a1');
  await expect(error).toBeHidden();
  await expect(page.getByText('Must start with a letter.', { exact: true })).toBeHidden();
  await expect(page.getByText("Can't contain special characters or spaces.", { exact: true })).toBeHidden();

  const maximumLengthError = page.getByText('Must be shorter than 11 characters.', { exact: true });
  await nickname.fill('Qa123456789');
  await expect(maximumLengthError).toBeVisible();
  await nickname.fill('Qa12345678');
  await expect(maximumLengthError).toBeHidden();
});

test('nickname rejects a numeric first character, special characters, and spaces', async ({ page }) => {
  const nickname = page.getByLabel('Nickname', { exact: true });
  const firstCharacterError = page.getByText('Must start with a letter.', { exact: true });
  const formatError = page.getByText("Can't contain special characters or spaces.", { exact: true });

  await fillValidDetailsExceptNickname(page);
  await nickname.fill('123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(firstCharacterError).toBeVisible();
  await nickname.fill('!!!!!');
  await expect(formatError).toBeVisible();
  await nickname.fill('qa tester');
  await expect(formatError).toBeVisible();

  await nickname.fill('QaTester');
  await expect(firstCharacterError).toBeHidden();
  await expect(formatError).toBeHidden();
});

test('state is displayed for United States and hidden for Israel', async ({ page }) => {
  const country = page.getByLabel('Country', { exact: true });
  const state = page.getByLabel('State', { exact: true });

  // The custom select's painted value has a zero-height text wrapper.
  // Assert the submitted country value and the visible dependent field instead.
  await expect(page.locator('input[name="country"]')).toHaveValue('US');
  await expect(state).toBeVisible();
  await state.click();
  await page.getByText('Alabama', { exact: true }).click();
  await expect(page.locator('input[name="state"]')).not.toHaveValue('');

  await country.click();
  await page.getByText('Israel', { exact: true }).click();
  await expect(page.locator('input[name="country"]')).toHaveValue('IL');
  await expect(state).toBeHidden();

  await country.click();
  await page.getByText('United States', { exact: true }).click();
  await expect(page.locator('input[name="country"]')).toHaveValue('US');
  await expect(state).toBeVisible();
});
