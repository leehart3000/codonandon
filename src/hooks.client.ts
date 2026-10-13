import * as Sentry from '@sentry/svelte';
import type { HandleClientError } from '@sveltejs/kit/hooks';
import { APP } from '#lib/config.js';

// We use @sentry/svelte rather than @sentry/sveltekit: the SvelteKit package's
// default add-ons still use $app/stores, which SvelteKit 3 removed (app_stores_removed).
Sentry.init({
	// Where error reports are sent: paste your Sentry project's DSN here.
	// While it's empty, Sentry stays switched off.
	dsn: '',

	// Only report from the live site, never from local development or automated tests.
	enabled: location.hostname === APP.hostname,

	// Don't collect personal data such as IP addresses.
	dataCollection: { userInfo: false }
});

// Report unexpected errors that SvelteKit catches itself, such as failures while loading
// a page. Skip 404s ('framework') and errors raised on purpose ('app'): they aren't bugs.
// Errors elsewhere, such as in button clicks, are caught by Sentry automatically.
export const handleError: HandleClientError = ({ kind, error }) => {
	if (kind === 'unknown') Sentry.captureException(error);
};
