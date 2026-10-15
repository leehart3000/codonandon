/**
 * Settings that change for each app.
 * When starting a new app from the template, change these values first.
 */
export const APP = {
	name: 'Tetraminos',
	shortName: 'Tetraminos',
	description: 'An educational falling-blocks game about mRNA, codons and amino acids.',
	hostname: 'tetraminos.hartsoft.dev',
	sourceUrl: 'https://github.com/leehart3000/tetraminos',
	/** Cloudflare Turnstile site key (public). The matching secret is a Worker secret. */
	turnstileSiteKey: '0x4AAAAAAFX5a4VULA9dZlJg',
	themeColor: '#0f172a',
	backgroundColor: '#0f172a'
} as const;
