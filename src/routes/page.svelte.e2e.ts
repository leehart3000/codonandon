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

test('tips are on by default: the first card shows, and play begins after Continue', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Start game' }).click();
	const card = page.getByRole('dialog');
	await expect(card).toContainText('Bases and codons');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(card).toBeHidden();
});

test('ending a game shows the results, and Play again starts a fresh game', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Start game' }).click();
	await page.getByRole('button', { name: 'Continue' }).click();
	await page.keyboard.press('p');
	await expect(page.getByText('Paused')).toBeVisible();

	await page.getByRole('button', { name: 'End game' }).click();
	await page.getByRole('button', { name: 'Yes, end it' }).click();
	await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();

	await page.getByRole('button', { name: 'Play again' }).click();
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Game over' })).toBeHidden();
	await expect(page.getByText('Paused')).toBeHidden();
});

test('the About page explains privacy, including the Turnstile notice', async ({ page }) => {
	await page.goto('/about');
	await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
	await expect(page.getByRole('link', { name: /Turnstile Privacy Addendum/ })).toHaveAttribute(
		'href',
		'https://www.cloudflare.com/turnstile-privacy-policy/'
	);
});
