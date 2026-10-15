/** The parts of Cloudflare's Turnstile script that the game uses. */
interface TurnstileApi {
	render(container: HTMLElement, options: Record<string, unknown>): string;
	remove(widgetId: string): void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;

/** Load Turnstile's script once, only when a score is being saved (never during play). */
function loadScript(): Promise<void> {
	if (window.turnstile) return Promise.resolve();
	loading ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			loading = null;
			reject(new Error('Could not load the human check. Please try again.'));
		};
		// appendChild, not append: Cloudflare's server types redefine `append` and confuse TypeScript.
		document.head.appendChild(script);
	});
	return loading;
}

/** Run the invisible "are you human?" check, and return its one-time token. */
export async function getTurnstileToken(siteKey: string, container: HTMLElement): Promise<string> {
	await loadScript();
	const turnstile = window.turnstile;
	if (!turnstile) throw new Error('Could not load the human check. Please try again.');

	return new Promise<string>((resolve, reject) => {
		let widgetId = '';
		const fail = () => {
			turnstile.remove(widgetId);
			reject(new Error('The human check did not complete. Please try again.'));
		};
		widgetId = turnstile.render(container, {
			sitekey: siteKey,
			callback: (token: string) => {
				turnstile.remove(widgetId);
				resolve(token);
			},
			'error-callback': fail,
			'timeout-callback': fail
		});
	});
}
