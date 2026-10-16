<script lang="ts">
	import { tick, untrack } from 'svelte';

	/** One row of the high-score table, as the API returns it. */
	interface Entry {
		initials: string;
		score: number;
		level: number;
	}

	let {
		highlightRank = null,
		closeLabel = 'Back',
		onClose
	}: {
		/** The player's just-saved position, highlighted in the table. */
		highlightRank?: number | null;
		/** What the close button says: "Main menu" or "Back". */
		closeLabel?: string;
		onClose: () => void;
	} = $props();

	/** Top 10 by default; opens at the top 100 if the highlighted score is further down. */
	let limit = $state(untrack(() => ((highlightRank ?? 0) > 10 ? 100 : 10)));
	let scores = $state<Entry[] | null>(null);
	let error = $state('');

	async function load(count: number) {
		scores = null;
		error = '';
		try {
			const response = await fetch(`/api/scores?limit=${count}`);
			if (!response.ok) throw new Error('Not loaded');
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
		<h2 id="high-scores-title" class="text-2xl font-black tracking-wide text-gold uppercase">
			{limit === 10 ? 'Top 10' : 'Top 100'}
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
					{#each scores as entry, index (index)}
						{@const mine = index + 1 === highlightRank}
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

		<div class="flex w-full max-w-56 flex-col gap-2">
			<button
				type="button"
				class="min-h-11 rounded border-2 border-gold px-6 font-semibold tracking-wide text-gold uppercase hover:bg-gold/10"
				onclick={() => (limit = limit === 10 ? 100 : 10)}
			>
				{limit === 10 ? 'Top 100' : 'Top 10'}
			</button>
			<button
				type="button"
				class="min-h-11 rounded border-2 border-gold px-6 font-semibold tracking-wide text-gold uppercase hover:bg-gold/10"
				onclick={onClose}
			>
				{closeLabel}
			</button>
		</div>
	</div>
</div>
