# CodonAndon

An educational falling-blocks game about mRNA, codons and amino acids.

**Play it:** [codonandon.hartsoft.dev](https://codonandon.hartsoft.dev)

Every square is an mRNA base (A, U, G or C). Cleared rows are read like a strand of mRNA: form a start codon (AUG) to begin a chain of amino acids, and a stop codon (UAA, UAG or UGA) to bank it for bonus points. Each codon after the start adds an amino acid, using the standard genetic code.

It plays on phones (touch gestures), tablets and computers (keyboard), installs as an app, and works offline once loaded.

## Features

- Falling-blocks gameplay on a 12 × 20 board, with the 7 tetrominoes
- Continuous mRNA reading: start codons found anywhere, reading in frame until a stop codon
- On-board highlights for start codons, in-frame stop codons and opportunities
- Optional tip cards that introduce the biology one idea at a time
- Game-over stats: amino acids collected, longest chain compared with real peptides
- Online high scores (top 10 and top 100), with arcade-style initials entry
- Chiptune sound effects and original music, generated in the browser (no audio files)
- Installable progressive web app, playable offline

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) 3, [Svelte](https://svelte.dev) 5, TypeScript, [Tailwind CSS](https://tailwindcss.com) 4, [Vite](https://vite.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) hosting, with [D1](https://developers.cloudflare.com/d1/) (SQLite) for high scores and [Turnstile](https://developers.cloudflare.com/turnstile/) for bot protection
- [Vitest](https://vitest.dev) (unit and in-browser component tests) and [Playwright](https://playwright.dev) (end-to-end tests)
- ESLint, Prettier, GitHub Actions, Dependabot, TruffleHog secret scanning
- Cloudflare Web Analytics (cookieless) and [Sentry](https://sentry.io) error reporting (EU, no IP addresses)

## Getting started

You need [Node.js](https://nodejs.org) (the version in `.node-version`; [fnm](https://github.com/Schniz/fnm) picks it up automatically) and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm exec wrangler d1 migrations apply codonandon --local   # create the local database
pnpm run dev                                                # http://localhost:5173
```

To try it on a phone on the same Wi-Fi, use `pnpm run dev --host` and open the "Network" address it prints. (Offline mode and installing need HTTPS, so they only work on the live site.)

On the dev server, Turnstile uses Cloudflare's always-pass test keys, so saving scores works without the real secret.

## Scripts

| Command              | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `pnpm run dev`       | Development server                                                   |
| `pnpm run verify`    | Everything CI checks: types, lint and formatting, unit and e2e tests |
| `pnpm run check`     | Type checks (Svelte and the service worker)                          |
| `pnpm run lint`      | Prettier and ESLint checks                                           |
| `pnpm run format`    | Format all files with Prettier                                       |
| `pnpm run test:unit` | Unit and component tests (Vitest; add `--run` to run once)           |
| `pnpm run test:e2e`  | End-to-end tests (Playwright)                                        |
| `pnpm run gen`       | Regenerate Cloudflare types after changing `wrangler.jsonc`          |
| `pnpm run build`     | Production build                                                     |
| `pnpm run deploy`    | Build and deploy to Cloudflare (CI does this automatically)          |

Always use `pnpm run deploy`, not `pnpm deploy` (which is a different, built-in pnpm command).

## Tests

- **Unit tests** (`*.spec.ts`) sit beside the code they test, mostly in `src/lib/game`, `src/lib/genetics`, `src/lib/audio` and `src/lib/server`. They cover the game rules, the genetic code, scoring, high-score validation and more.
- **Component tests** (`*.svelte.spec.ts`) run in a real browser (Chromium).
- **End-to-end tests** (`src/routes/*.e2e.ts`) play through the app in a browser.

## Database

High scores are stored in Cloudflare D1. The schema lives in `migrations/`, as numbered SQL files. To change it, add a new migration (never edit an applied one), then apply it locally and live:

```sh
pnpm exec wrangler d1 migrations apply codonandon --local
pnpm exec wrangler d1 migrations apply codonandon --remote
```

No IP addresses or other personal data are stored: only initials and game statistics.

## Secrets

The Turnstile **secret** key is a Worker secret, never in the repository:

```sh
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

The Turnstile **site** key in `src/lib/config.ts` is public by design.

## Moderation

Names are checked against a `blocked_initials` table (letters only; spaces and full stops are ignored when checking). The list itself is kept **out of this repository**: add entries directly to the database, for example from a private SQL file of `INSERT OR IGNORE INTO blocked_initials (initials) VALUES ('XXX');` lines:

```sh
pnpm exec wrangler d1 execute codonandon --remote --file path/to/blocked-initials.sql
```

To find and remove a score:

```sh
pnpm exec wrangler d1 execute codonandon --remote --command "SELECT id, initials, score, created_at FROM scores ORDER BY created_at DESC LIMIT 20"
pnpm exec wrangler d1 execute codonandon --remote --command "DELETE FROM scores WHERE id = 123"
```

## Deployment

Every push to `main` runs CI (`.github/workflows/ci.yml`): type checks, linting, tests and a secret scan. If they all pass, and the repository variable `DEPLOY_ENABLED` is `true`, it deploys to Cloudflare using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.

The start screen shows the version of the build you're running: the last release tag, how many commits since it, and the commit, such as `v0.1.0+1/c49aa02` (just `v0.1.0/c49aa02` for the tagged release itself). To mark a release, tag it and push the tag:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The next deploy (the next push to `main`) then shows the new version.

## Project structure

```
src/
  lib/
    audio/        Sound effects, music (score and player) and sound cues
    components/   Game, high scores and the genetic-code rain
    game/         Game engine: board, pieces, reading, scoring, highlights, tips
    genetics/     The genetic code and real peptides
    server/       High-score validation and Turnstile (server only)
    config.ts     App settings: name, colours, URLs
  routes/
    about/        About and privacy page
    api/scores/   High-score API
  service-worker/ Offline support
migrations/       Database schema (D1)
static/           Icons
```

## Licence

[AGPL-3.0-only](LICENSE). © 2026 [Lee Hart](https://hartsoft.dev).

CodonAndon is not affiliated with or endorsed by Tetris or The Tetris Company.
