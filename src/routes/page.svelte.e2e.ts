import { expect, test } from '@playwright/test';
import { APP } from '../lib/config';

test('home page shows the app name', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText(APP.name);
	await expect(page).toHaveTitle(APP.name);
});

test('web app manifest uses the app settings', async ({ request }) => {
	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	expect(manifest.name).toBe(APP.name);
	expect(manifest.theme_color).toBe(APP.themeColor);
});

test('the game waits for the player to press Start', async ({ page }) => {
	await page.goto('/');
	const start = page.getByRole('button', { name: 'Start' });
	await expect(start).toBeVisible();
	await start.click();
	await expect(start).toBeHidden();
});

test('with tips on in Settings, the first card shows, and play begins after Continue', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('switch', { name: 'Show tips in game' }).click();
	await page.getByRole('button', { name: 'Back' }).click();
	await page.getByRole('button', { name: 'Start game' }).click();
	const card = page.getByRole('dialog');
	await expect(card).toContainText('Bases and codons');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(card).toBeHidden();
});
