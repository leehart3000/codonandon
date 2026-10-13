<script lang="ts">
	import { onMount } from 'svelte';
	import { playState } from './play-state.svelte.js';

	// True when a new version has been downloaded and is waiting to take over.
	let updateReady = $state(false);

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;

		let registration: ServiceWorkerRegistration | undefined;
		let reloading = false;

		void navigator.serviceWorker.ready.then((reg) => {
			registration = reg;

			// A new version may already be waiting when the page loads.
			if (reg.waiting && navigator.serviceWorker.controller) updateReady = true;

			// Or one may arrive while the page is open.
			reg.addEventListener('updatefound', () => {
				const worker = reg.installing;
				worker?.addEventListener('statechange', () => {
					if (worker.state === 'installed' && navigator.serviceWorker.controller) {
						updateReady = true;
					}
				});
			});
		});

		// Check for a new version whenever the user comes back to this tab or app.
		function checkForUpdate() {
			if (document.visibilityState === 'visible') void registration?.update();
		}
		document.addEventListener('visibilitychange', checkForUpdate);

		// Once the new version has taken over, reload once to show it.
		function onControllerChange() {
			if (reloading) return;
			reloading = true;
			location.reload();
		}
		navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

		return () => {
			document.removeEventListener('visibilitychange', checkForUpdate);
			navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
		};
	});

	async function applyUpdate() {
		const registration = await navigator.serviceWorker.getRegistration();
		if (registration?.waiting) {
			// Ask the waiting version to take over. The page reloads when it does.
			registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		} else {
			location.reload();
		}
	}
</script>

{#if updateReady && !playState.playing}
	<div
		role="status"
		class="fixed inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-slate-800 p-3 text-white"
	>
		<span>A new version is available.</span>
		<button
			type="button"
			class="rounded bg-white px-3 py-1 font-semibold text-slate-900"
			onclick={applyUpdate}
		>
			Reload
		</button>
	</div>
{/if}
