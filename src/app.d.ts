// See https://svelte.dev/docs/kit/types#app.d.ts
// Cloudflare bindings (such as DB) come from `cloudflare:workers` in SvelteKit 3, not `platform`.
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
