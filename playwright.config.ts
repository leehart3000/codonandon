import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		// Building can take over a minute on a busy Mac.
		timeout: 120_000
	},
	testMatch: '**/*.e2e.{ts,js}'
});
