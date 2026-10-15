import { expect, type Page } from '@playwright/test';

export async function selectSignupOption(page: Page, field: 'country' | 'state', label: string) {
  const dropdown = page.getByTestId(`${field}Dropdown`);
  await dropdown.click();
  // This application's react-select has no option/listbox ARIA roles.
  const option = dropdown.locator('[id*="-option-"]').and(dropdown.getByText(label, { exact: true }));
  await expect(option).toBeVisible();
  await option.click();
}
