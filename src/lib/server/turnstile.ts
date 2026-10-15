/** Where the server asks Cloudflare whether a Turnstile token is genuine. */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare's test secret that always passes: used only during local development. */
export const TEST_SECRET = '1x0000000000000000000000000000000AA';

/**
 * Check a Turnstile token with Cloudflare. Fails safely: any problem (no secret, no token,
 * network error, unexpected reply) means "not verified".
 */
export async function verifyTurnstile(
	token: unknown,
	secret: string | undefined,
	fetcher: typeof fetch = fetch
): Promise<boolean> {
	if (!secret || typeof token !== 'string' || token.length === 0 || token.length > 2048) {
		return false;
	}
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	try {
		const response = await fetcher(VERIFY_URL, { method: 'POST', body });
		if (!response.ok) return false;
		const result = (await response.json()) as { success?: unknown };
		return result.success === true;
	} catch {
		return false;
	}
}
