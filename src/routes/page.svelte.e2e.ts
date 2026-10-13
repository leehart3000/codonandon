import { expect, test } from '@playwright/test';

test('home page shows the game title', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Tetraminos');
});
