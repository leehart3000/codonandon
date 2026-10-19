/**
 * Settings that change for each app.
 * When starting a new app from the template, change these values first.
 */
export const APP = {
	name: 'Codonandon',
	shortName: 'Codonandon',
	hostname: 'codonandon.hartsoft.dev',
	sourceUrl: 'https://github.com/leehart3000/codonandon',
	description: 'An educational falling-blocks game about mRNA, codons and amino acids.',
	/** For privacy questions and score removal requests, shown on the About page. */
	contactEmail: 'codonandon@hartsoft.dev',
	/** For the copyright notice on the main menu. */
	author: 'Lee Hart',
	authorUrl: 'https://hartsoft.dev',
	copyrightYear: 2026,
	/** Cloudflare Turnstile site key (public). The matching secret is a Worker secret. */
	turnstileSiteKey: '0x4AAAAAAFX5a4VULA9dZlJg',
	themeColor: '#020617',
	backgroundColor: '#020617'
} as const;
