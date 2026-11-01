import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { formatVersion } from './src/lib/build-version';

/** A git command's output, or null if it fails (for example, no tags yet). */
function git(command: string): string | null {
	try {
		return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return null;
	}
}

/**
 * Name each build after the last release tag and its git commit, such as "v0.1.0+1/c49aa02",
 * so you can tell versions apart. Without a tag (or git), fall back to the commit alone.
 */
function buildVersion(): string {
	const described = git('describe --tags --long --abbrev=7');
	if (described) return formatVersion(described);
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
	return git('rev-parse --short=7 HEAD') ?? Date.now().toString();
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				// During tests, keep simulator storage in memory so test groups don't
				// lock the same database file. Normal dev still saves to .wrangler/state.
				platformProxy: { persist: !process.env.VITEST }
			}),
			version: { name: buildVersion() }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
