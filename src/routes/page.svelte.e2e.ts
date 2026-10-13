import { expect, test } from '@playwright/test';
import { APP } from '../lib/config';

test('home page shows the game title', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText(APP.name);
	await expect(page).toHaveTitle(APP.name);
});

test('web app manifest uses the game settings', async ({ request }) => {
	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	expect(manifest.name).toBe(APP.name);
	expect(manifest.theme_color).toBe(APP.themeColor);
});
