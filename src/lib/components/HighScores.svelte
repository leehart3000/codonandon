<script lang="ts">
	import { tick, untrack } from 'svelte';

	/** One row of the high-score table, as the API returns it. */
	interface Entry {
		id: number;
		initials: string;
		score: number;
		level: number;
	}

	let {
		highlightId = null,
		startLimit = 10,
		closeLabel = 'Back',
		onClose
	}: {
		/** The player's just-saved score, highlighted in the table. */
		highlightId?: number | null;
		/** Open at the top 10 or the top 100. */
		startLimit?: 10 | 100;
		/** What the close button says: "Main menu" or "Back". */
		closeLabel?: string;
		onClose: () => void;
	} = $props();

	let limit = $state(untrack(() => startLimit));
	let scores = $state<Entry[] | null>(null);
	let error = $state('');

	async function load(count: number) {
		error = '';
		try {
			const response = await fetch(`/api/scores?limit=${count}`);
			if (!response.ok) throw new Error('Not loaded');
			// Replace the list only once the new one has arrived, so there's no flicker.
			scores = ((await response.json()) as { scores: Entry[] }).scores;
			// Bring the player's own score into view.
			await tick();
			document.getElementById('my-score')?.scrollIntoView({ block: 'center' });
		} catch {
			error = navigator.onLine
				? 'Sorry, the high scores could not be loaded.'
				: 'High scores need an internet connection.';
		}
	}

	$effect(() => {
		void load(limit);
	});
</script>

<div
	class="absolute inset-0 z-30 overflow-y-auto bg-slate-900"
	role="dialog"
	aria-labelledby="high-scores-title"
>
	<div class="flex min-h-full flex-col items-center justify-center gap-3 p-3">
		<h2 id="high-scores-title" class="text-xl font-black tracking-wide text-gold uppercase">
			Top {limit} scores
		</h2>

		{#if error}
			<p>{error}</p>
		{:else if scores === null}
			<p>Loading…</p>
		{:else if scores.length === 0}
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
					{#each scores as entry, index (entry.id)}
						{@const mine = entry.id === highlightId}
						<tr id={mine ? 'my-score' : undefined} class:text-gold={mine} class:font-bold={mine}>
							<td class="px-2 text-right">{index + 1}</td>
							<td class="px-2 whitespace-pre">{entry.initials}</td>
							<td class="px-2 text-right opacity-70">{entry.level}</td>
							<td class="px-2 text-right">{entry.score}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		<div class="flex w-full max-w-72 gap-2">
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
		</div>
	</div>
</div>
