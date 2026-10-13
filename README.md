# Tetraminos

An educational falling-blocks game about mRNA, codons and amino acids.

**Live:** https://tetraminos.hartsoft.dev

## Tech stack

- **App:** SvelteKit 3, Svelte 5, Vite, TypeScript, Tailwind CSS
- **Hosting:** Cloudflare Workers (static assets, custom domain)
- **PWA:** web app manifest, SvelteKit service worker (offline play)
- **Testing:** Vitest (unit and component), Playwright (browser)
- **Code quality:** ESLint, Prettier, svelte-check; Husky + lint-staged on commit
- **CI/CD:** GitHub Actions (check, test, secret scan, then deploy)
- **Security:** Dependabot, GitHub secret scanning with push protection, TruffleHog
- **Monitoring:** Cloudflare Web Analytics (cookieless), Sentry (browser errors)

## Getting started

Requirements: [fnm](https://github.com/Schniz/fnm) (Node version from `.node-version`) and [pnpm](https://pnpm.io).

```sh
pnpm install                    # install dependencies (also sets up the Git hook)
pnpm exec playwright install    # download test browsers (once per computer)
pnpm run dev                    # start the local dev server at http://localhost:5173
```

## Commands

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `pnpm run dev`    | Local dev server with live reload                                  |
| `pnpm run build`  | Build for production                                               |
| `pnpm run deploy` | Build, then deploy to Cloudflare (normally done by GitHub Actions) |
| `pnpm run check`  | Type-check the app and the service worker                          |
| `pnpm run lint`   | Check formatting (Prettier) and code (ESLint)                      |
| `pnpm run format` | Fix formatting                                                     |
| `pnpm run test`   | Run all tests (Vitest, then Playwright)                            |
| `pnpm run verify` | Check, lint and test: the same as CI                               |
| `pnpm run gen`    | Regenerate Cloudflare types (after changing `wrangler.jsonc`)      |

Always use `pnpm run deploy`, **not** `pnpm deploy`. The latter is a built-in pnpm command that does something else.

## How it works

- **Settings** that change per app live in `src/lib/config.ts`. The page title, description, theme colour, manifest and tests all read from it.
- **Pages are prerendered** at build time (`src/routes/+layout.ts`), so they are served as plain files.
- **The web app manifest** is generated from the settings by `src/routes/manifest.webmanifest/+server.ts`.
- **The service worker** (`src/service-worker/index.ts`) caches the app for offline use. It never caches `/api/` requests or other websites.
- **On every commit**, Husky runs lint-staged, which fixes formatting and lint issues in the staged files.
- **On every push and pull request**, GitHub Actions type-checks, lints, tests and scans for secrets. On `main`, it then deploys to Cloudflare.

## Known quirks

- **`@sentry/sveltekit` breaks on SvelteKit 3** (`app_stores_removed`), so the app uses `@sentry/svelte` in `src/hooks.client.ts` instead. Don't set `tracesSampleRate`.
- **SvelteKit 3 moved hook types** to `@sveltejs/kit/hooks`, for example `HandleClientError`.
- **Build output and types:** `wrangler types` adds extra types if a build exists, so `check`, `gen` and `build` delete `.svelte-kit/cloudflare` first.
- **Harmless messages:** svelte-check warns "No svelte input files" for the service worker, and Vitest reports "close timed out". Both can be ignored.
- **iPhone home-screen apps** have separate storage from Safari. After installing with "Open as Web App", open it once while online before it works offline.

## New app checklist

When starting a new app from this template:

1. **Settings:** update every value in `src/lib/config.ts`.
2. **Package name:** change `"name"` in `package.json`.
3. **Cloudflare Worker:** change `"name"` and the `routes` pattern in `wrangler.jsonc`, then run `pnpm run gen`.
4. **Icon:** replace `static/icon.svg`, then regenerate the other sizes:
   `pnpm dlx @vite-pwa/assets-generator --preset minimal-2023 static/icon.svg`
5. **Home page:** replace the content of `src/routes/+page.svelte`.
6. **Web Analytics:** in Cloudflare, add the new hostname (manual setup), then replace the token in `src/app.html`.
7. **Sentry:** create a project (platform SvelteKit), turn on "Prevent Storing of IP Addresses", then replace the DSN in `src/hooks.client.ts`.
8. **Deploy token:** create a Cloudflare API token for this repo only (Workers Scripts: Edit, Account Settings: Read, Workers Routes: Edit on the zone, User Details: Read, Memberships: Read). Add GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
9. **GitHub security:** confirm Dependabot alerts, security updates, secret scanning and push protection are on.
10. **This README:** update the title, description and live address.
