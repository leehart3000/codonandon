import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	// Where error reports are sent. Public by design: it can only send, never read.
	dsn: 'https://4242b0dcd2cf3887903e30b48599282c@o4511932249341952.ingest.de.sentry.io/4512244695236688',

	// Only report from the live site, never from local development or automated tests.
	enabled: location.hostname === 'tetraminos.hartsoft.dev',

	// Errors only for now: no performance tracing or session replay.
	tracesSampleRate: 0,

	// Don't collect personal data such as IP addresses.
	dataCollection: { userInfo: false }
});

export const handleError = Sentry.handleErrorWithSentry();
