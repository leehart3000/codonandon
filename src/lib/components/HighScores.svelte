<script lang="ts">
	import { onMount } from 'svelte';

	/** One row of the high-score table, as the API returns it. */
	interface Entry {
		initials: string;
		score: number;
		level: number;
		rows: number;
		chains: number;
		longestChain: number;
		tips: number;
		offline: number;
		createdAt: string;
	}

	let {
		highlightRank = null,
		onClose
	}: {
		/** The player's just-saved position, highlighted in the table. */
		highlightRank?: number | null;
		onClose: () => void;
	} = $props();

	let scores = $state<Entry[] | null>(null);
	let error = $state('');

	const formatNumber = (value: number) => value.toLocaleString('en-GB');

	onMount(async () => {
		try {
			const response = await fetch('/api/scores');
			if (!response.ok) throw new Error('Not loaded');
			scores = ((await response.json()) as { scores: Entry[] }).scores;
		} catch {
			error = navigator.onLine
				? 'Sorry, the high scores could not be loaded.'
				: 'High scores need an internet connection.';
		}
	});
</script>

<div
	class="absolute inset-0 z-30 overflow-y-auto bg-slate-900 text-white"
	role="dialog"
	aria-labelledby="high-scores-title"
>
	<div class="flex min-h-full flex-col items-center justify-center gap-3 p-3">
		<h2 id="high-scores-title" class="text-lg font-black tracking-wide uppercase">High scores</h2>

		{#if error}
			<p class="text-sm">{error}</p>
		{:else if scores === null}
			<p class="text-sm">Loading…</p>
		{:else if scores.length === 0}
			<p class="text-sm">No scores yet. Be the first!</p>
		{:else}
			<table class="mx-auto font-mono text-sm">
				<thead class="text-[10px] uppercase opacity-70">
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
						<tr class:text-gold={mine} class:font-bold={mine}>
							<td class="px-2 text-right">{index + 1}</td>
							<td class="px-2 whitespace-pre">{entry.initials}</td>
							<td class="px-2 text-right opacity-70">{entry.level}</td>
							<td class="px-2 text-right">{formatNumber(entry.score)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		<button
			type="button"
			class="min-h-11 rounded border-2 border-gold px-6 font-semibold tracking-wide text-gold uppercase hover:bg-gold/10"
			onclick={onClose}
		>
			Back
		</button>
	</div>
</div>
