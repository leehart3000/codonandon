import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CodeRain from './CodeRain.svelte';

describe('genetic-code rain', () => {
	it('draws at the height it is given', async () => {
		await render(CodeRain, { height: 40 });
		expect(document.querySelector('canvas')?.style.height).toBe('40px');
	});

	it('is decoration, hidden from screen readers', async () => {
		await render(CodeRain);
		expect(document.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
	});
});
