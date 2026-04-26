import { test, expect } from '@playwright/test';

test.describe('Layout / SpineNav', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // --- Presence ---

  test('renders nav with all 3 links', async ({ page }) => {
    const nav = page.locator('nav.spine');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Deck Builder' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Library' })).toBeVisible();
  });

  test('renders Log In and Sign Up buttons when logged out', async ({ page }) => {
    const nav = page.locator('nav.spine');
    await expect(nav.getByRole('button', { name: 'Log In' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Sign Up' })).toBeVisible();
  });

  // --- Navigation ---

  test('Home link navigates to /', async ({ page }) => {
    await page.locator('nav.spine').getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL('/');
  });

  test('Deck Builder link navigates to /deck-builder', async ({ page }) => {
    await page.locator('nav.spine').getByRole('link', { name: 'Deck Builder' }).click();
    await expect(page).toHaveURL('/deck-builder');
  });

  // --- Active state ---

  test('Home link is active on landing page', async ({ page }) => {
    const homeLink = page.locator('nav.spine').getByRole('link', { name: 'Home' });
    await expect(homeLink).toHaveClass(/active/);
  });

  test('Deck Builder link is active on /deck-builder', async ({ page }) => {
    await page.goto('/deck-builder');
    const deckLink = page.locator('nav.spine').getByRole('link', { name: 'Deck Builder' });
    await expect(deckLink).toHaveClass(/active/);
  });
});
