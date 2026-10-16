<script module lang="ts">
	/** A finished game, ready to save once the player adds their initials. */
	export interface NewScore {
		score: number;
		level: number;
		rows: number;
		chains: number;
		longestChain: number;
		durationMs: number;
		generatorVersion: number;
		tips: boolean;
	}
</script>

<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { APP } from '#lib/config.js';
	import { getTurnstileToken } from '#lib/turnstile-client.js';

	/** One row of the high-score table, as the API returns it. */
	interface Entry {
		id: number;
		initials: string;
		score: number;
		level: number;
	}

	/** A table row: a saved score, or the player's new one waiting for initials. */
	type Row = { kind: 'score'; entry: Entry } | { kind: 'new' };

	let {
		newScore = null,
		highlightId = null,
		startLimit = 10,
		closeLabel = 'Back',
		onSaved,
		onClose
	}: {
		/** A just-finished game: if it makes the top 100, the player enters initials in its row. */
		newScore?: NewScore | null;
		/** A saved score to highlight in the table. */
		highlightId?: number | null;
		/** Open at the top 10 or the top 100. */
		startLimit?: 10 | 100;
		/** What the close button says: "Main menu" or "Back". */
		closeLabel?: string;
		/** Called once the new score is saved. */
		onSaved?: (id: number, rank: number) => void;
		onClose: () => void;
	} = $props();

	/** Where the player's initials are remembered in this browser. */
	const INITIALS_KEY = 'initials';
	/** Turnstile site key: Cloudflare's always-pass invisible test key on the dev server. */
	const TURNSTILE_SITE_KEY = import.meta.env.DEV
		? '1x00000000000000000000BB'
		: APP.turnstileSiteKey;

	let limit = $state<10 | 100>(untrack(() => startLimit));
	let scores = $state<Entry[] | null>(null);
	let error = $state('');
	let initials = $state('');
	let saving = $state(false);
	let saveError = $state('');
	let savedId = $state<number | null>(untrack(() => highlightId));
	let turnstileBox: HTMLDivElement | undefined = $state();
	/** Only say "Loading…" if loading takes a while, to avoid a flicker. */
	let slow = $state(false);

	/** Where a score would go: after every score that is higher or equal (earlier ties come first). */
	const rankFor = (list: Entry[], score: number) =>
		list.filter((entry) => entry.score >= score).length + 1;

	const pendingRank = $derived(
		newScore && savedId === null && scores ? rankFor(scores, newScore.score) : null
	);
	/** True while the player is entering initials for a top-100 score. */
	const entering = $derived(pendingRank !== null && pendingRank <= 100);

	const rows = $derived.by((): Row[] => {
		if (!scores) return [];
		const list: Row[] = scores.map((entry) => ({ kind: 'score', entry }));
		if (entering && pendingRank !== null) list.splice(pendingRank - 1, 0, { kind: 'new' });
		return list.slice(0, limit);
	});

	/** Load the top 100 once; the table shows 10 or 100 of them. */
	async function load() {
		error = '';
		try {
			const response = await fetch('/api/scores?limit=100');
			if (!response.ok) throw new Error('Not loaded');
			const list = ((await response.json()) as { scores: Entry[] }).scores;
			// A new score opens wherever it lands: the top 10 if it fits there, otherwise the top 100.
			if (newScore && savedId === null) limit = rankFor(list, newScore.score) <= 10 ? 10 : 100;
			scores = list;
			// Bring the player's own row into view.
			await tick();
			document.getElementById('my-score')?.scrollIntoView({ block: 'center' });
		} catch {
			error = navigator.onLine
				? 'Sorry, the high scores could not be loaded.'
				: 'High scores need an internet connection.';
		}
	}

	/** Save the new score with the player's initials, after the invisible "are you human?" check. */
	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!newScore || !turnstileBox || saving) return;
		const clean = initials.trim().toUpperCase();
		if (!/^[A-Z. ]{1,3}$/.test(clean) || !/[A-Z]/.test(clean)) {
			saveError = 'Please enter 1 to 3 letters (spaces and full stops are fine too).';
			return;
		}

		saving = true;
		saveError = '';
		try {
			const turnstileToken = await getTurnstileToken(TURNSTILE_SITE_KEY, turnstileBox);
			const response = await fetch('/api/scores', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...newScore, initials: clean, offline: false, turnstileToken })
			});
			const result = (await response.json()) as { id?: number; rank?: number; error?: string };
			if (response.ok && result.id && result.rank) {
				savedId = result.id;
				try {
					localStorage.setItem(INITIALS_KEY, clean);
				} catch {
					// Not remembered; that's fine.
				}
				onSaved?.(result.id, result.rank);
				if (result.rank > 10) limit = 100;
				await load();
			} else {
				saveError = result.error ?? 'Sorry, the score could not be saved.';
			}
		} catch (problem) {
			saveError = !navigator.onLine
				? "You're offline, so the score can't be saved right now."
				: problem instanceof Error
					? problem.message
					: 'Sorry, the score could not be saved.';
		} finally {
			saving = false;
		}
	}

	/** Put the cursor straight into the initials box, ready to type. */
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	onMount(() => {
		try {
			initials = localStorage.getItem(INITIALS_KEY) ?? '';
		} catch {
			// Storage unavailable: start with empty initials.
		}
		void load();
		const timer = setTimeout(() => (slow = true), 500);
		return () => clearTimeout(timer);
	});
</script>

<div
	class="absolute inset-0 z-30 overflow-y-auto bg-slate-900"
	role="dialog"
	aria-labelledby="high-scores-title"
>
	<div class="flex min-h-full flex-col items-center justify-center gap-3 p-3">
		<!-- The title stays at the top while the table scrolls. Hidden until the scores arrive. -->
		<div class="sticky top-0 z-10 w-full bg-slate-900 pt-1 pb-2 text-center">
			{#if scores !== null || error || slow}
				<h2 id="high-scores-title" class="text-xl font-black tracking-wide text-gold uppercase">
					{entering ? 'New high score!' : `Top ${limit} scores`}
				</h2>
				{#if entering}
					<p class="text-sm">Enter your initials</p>
				{:else if newScore && savedId === null && scores}
					<p class="text-sm">Not in the top 100 this time. Keep playing!</p>
				{/if}
			{/if}
		</div>

		{#if error}
			<p>{error}</p>
		{:else if scores === null}
			{#if slow}
				<p>Loading…</p>
			{/if}
		{:else if rows.length === 0}
			<p>No scores yet. Be the first!</p>
		{:else}
			<table class="mx-auto font-mono text-xl">
				<thead class="text-xs uppercase opacity-70">
					<tr>
						<th class="px-2 text-right">#</th>
						<th class="px-2 text-left">Name</th>
						<th class="px-2 text-right">Lv</th>
						<th class="px-2 text-right">Score</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, index (row.kind === 'new' ? 'new' : row.entry.id)}
						{#if row.kind === 'new' && newScore}
							<tr id="my-score" class="font-bold text-gold">
								<td class="px-2 text-right">{index + 1}</td>
								<td class="px-2">
									<form id="initials-form" onsubmit={save}>
										<input
											use:focusOnMount
											bind:value={initials}
											aria-label="Your initials"
											maxlength="3"
											autocomplete="off"
											autocapitalize="characters"
											spellcheck="false"
											class="w-[3.5ch] border-b-2 border-gold bg-transparent font-mono text-gold uppercase outline-none"
										/>
									</form>
								</td>
								<td class="px-2 text-right opacity-70">{newScore.level}</td>
								<td class="px-2 text-right">{newScore.score}</td>
							</tr>
						{:else if row.kind === 'score'}
							{@const mine = row.entry.id === savedId}
							<tr id={mine ? 'my-score' : undefined} class:text-gold={mine} class:font-bold={mine}>
								<td class="px-2 text-right">{index + 1}</td>
								<td class="px-2 whitespace-pre">{row.entry.initials}</td>
								<td class="px-2 text-right opacity-70">{row.entry.level}</td>
								<td class="px-2 text-right">{row.entry.score}</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		{/if}

		<!-- The buttons stay at the bottom while the table scrolls. -->
		<div class="sticky bottom-0 z-10 w-full bg-slate-900 py-2">
			{#if saveError}
				<p class="mb-2 text-center text-sm text-uracil" role="alert">{saveError}</p>
			{/if}
			<!-- Turnstile's invisible check runs here; nothing is shown. -->
			<div bind:this={turnstileBox}></div>

			<div class="mx-auto flex w-full max-w-72 gap-2">
				{#if entering}
					<button
						type="submit"
						form="initials-form"
						class="min-h-11 flex-1 rounded bg-gold px-2 text-sm font-semibold tracking-wide text-slate-900 uppercase disabled:opacity-50"
						disabled={saving}
					>
						{saving ? 'Saving…' : 'Save'}
					</button>
					<button
						type="button"
						class="min-h-11 flex-1 rounded border-2 border-gold px-2 text-sm font-semibold tracking-wide text-gold uppercase hover:bg-gold/10"
						onclick={onClose}
					>
						Don't save
					</button>
				{:else}
					<button
						type="button"
						class="min-h-11 flex-1 rounded border-2 border-gold px-2 text-sm font-semibold tracking-wide text-gold uppercase hover:bg-gold/10"
						onclick={() => (limit = limit === 10 ? 100 : 10)}
					>
						Top {limit === 10 ? 100 : 10}
					</button>
					<button
						type="button"
						class="min-h-11 flex-1 rounded border-2 border-gold px-2 text-sm font-semibold tracking-wide text-gold uppercase hover:bg-gold/10"
						onclick={onClose}
					>
						{closeLabel}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
