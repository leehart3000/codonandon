// Worker secrets (set with `wrangler secret put`) aren't in wrangler.jsonc,
// so `wrangler types` can't list them. Declared here instead.
declare namespace Cloudflare {
	interface Env {
		/** Turnstile secret key. Missing during local development, where a test key is used. */
		TURNSTILE_SECRET_KEY?: string;
	}
}
