import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from './turnstile';

/** A stand-in for Cloudflare's reply. */
const reply = (body: unknown, ok = true) =>
	vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe('Turnstile verification', () => {
	it('accepts a token that Cloudflare confirms', async () => {
		expect(await verifyTurnstile('token', 'secret', reply({ success: true }))).toBe(true);
	});

	it('rejects a token that Cloudflare does not confirm', async () => {
		expect(await verifyTurnstile('token', 'secret', reply({ success: false }))).toBe(false);
	});

	it('rejects without asking Cloudflare when the token or secret is missing', async () => {
		const fetcher = reply({ success: true });
		expect(await verifyTurnstile(undefined, 'secret', fetcher)).toBe(false);
		expect(await verifyTurnstile('', 'secret', fetcher)).toBe(false);
		expect(await verifyTurnstile('token', undefined, fetcher)).toBe(false);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('fails safely if Cloudflare cannot be reached', async () => {
		const broken = vi.fn(async () => {
			throw new Error('offline');
		});
		expect(await verifyTurnstile('token', 'secret', broken)).toBe(false);
		expect(await verifyTurnstile('token', 'secret', reply({}, false))).toBe(false);
	});
});
