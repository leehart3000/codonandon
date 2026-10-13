import { APP } from '#lib/config.js';

// Build this file once, when the site is built, so it's served as a plain file.
export const prerender = true;

export function GET() {
	const manifest = {
		name: APP.name,
		short_name: APP.shortName,
		description: APP.description,
		id: '/',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: APP.backgroundColor,
		theme_color: APP.themeColor,
		icons: [
			{ src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
			{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
			{
				src: '/maskable-icon-512x512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		]
	};

	return new Response(JSON.stringify(manifest, null, '\t'), {
		headers: { 'content-type': 'application/manifest+json' }
	});
}
