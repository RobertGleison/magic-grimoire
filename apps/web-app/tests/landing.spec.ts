import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // --- Navigation ---

  test('hero button navigates to deck-builder', async ({ page }) => {
    await page.getByRole('button', { name: 'Ask the Grimoire' }).first().click();
    await expect(page).toHaveURL('/deck-builder');
  });

  test('CTA button navigates to deck-builder', async ({ page }) => {
    await page.getByRole('button', { name: 'Ask the Grimoire' }).last().click();
    await expect(page).toHaveURL('/deck-builder');
  });

  // --- Content presence ---

  test('renders ArcaneSigil in hero', async ({ page }) => {
    await expect(page.locator('[class*="heroSigil"] svg')).toBeVisible();
  });

  test('renders all 4 steps', async ({ page }) => {
    for (const title of ['Describe', 'Search', 'Build', 'Revision']) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
  });

  test('renders all 4 features', async ({ page }) => {
    for (const title of ['All Colors', 'All Formats', 'Synergies', 'Iteration']) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
  });

  test('renders marquee incantations', async ({ page }) => {
    await expect(page.getByText(/fast red deck for Pioneer/).first()).toBeVisible();
  });

  // --- Accessibility ---

  test('has no WCAG violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
