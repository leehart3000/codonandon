<script lang="ts">
	import { onMount } from 'svelte';
	import { BOARD_HEIGHT, BOARD_WIDTH, drop } from '#lib/game/board.js';
	import { createGame, fallInterval, type Action, type ClearReport } from '#lib/game/game.js';
	import { findMarks, previewMarks, type CodonMark } from '#lib/game/highlights.js';
	import type { Piece } from '#lib/game/pieces.js';
	import { chainBonus } from '#lib/game/scoring.js';
	import { AMINO_ACIDS, type Base } from '#lib/genetics/genetic-code.js';
	import { playState } from '#lib/play-state.svelte.js';

	/** Size of one square, in pixels. */
	const CELL = 28;

	/** Gap between codon slots (groups of 3 columns), in pixels: makes the reading frame visible. */
	const GAP = 6;

	/** Total board width in pixels, including the 3 gaps between the 4 slots. */
	const BOARD_PIXEL_WIDTH = BOARD_WIDTH * CELL + (BOARD_WIDTH / 3 - 1) * GAP;
	const BOARD_PIXEL_HEIGHT = BOARD_HEIGHT * CELL;

	/** Where a column starts, in pixels, allowing for the gaps between slots. */
	const columnX = (column: number) => column * CELL + Math.floor(column / 3) * GAP;

	/** Base colours, matching the icon: A green, U red, G gold, C blue. */
	const COLOURS: Record<Base, string> = {
		A: '#7ec98f',
		U: '#d97878',
		G: '#e3be71',
		C: '#7aa8d6'
	};

	/** START glows green, STOP glows red. */
	const MARK_COLOURS = { start: '#4ade80', stop: '#f87171' } as const;

	const KEYS: Record<string, Action> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowDown: 'down',
		ArrowUp: 'rotate-clockwise',
		x: 'rotate-clockwise',
		z: 'rotate-anticlockwise',
		' ': 'drop'
	};

	/** A fresh random seed for each new game. */
	const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

	let game = createGame({ seed: 1 });
	let view = $state.raw(game.state);
	/** True once the page's code is running, so buttons work when they appear. */
	let mounted = $state(false);
	let started = $state(false);
	let paused = $state(false);
	let log = $state<string[]>([]);
	let canvas: HTMLCanvasElement | undefined = $state();

	const chainOpen = $derived(started && !view.over && view.translation.chain !== null);

	/** Start a new game with a fresh seed. */
	function start() {
		game = createGame({ seed: randomSeed() });
		view = game.state;
		log = [];
		paused = false;
		started = true;
	}

	function act(action: Action) {
		if (!started || paused) return;
		const result = game.act(action);
		view = game.state;
		if (result.clear) describeClear(result.clear);
		if (result.gameOver && result.gameOver.unfinishedPoints > 0) {
			addLog(`Unfinished chain: +${result.gameOver.unfinishedPoints}`);
		}
	}

	/** Add lines to the reading log, newest at the top. */
	function addLog(...lines: string[]) {
		log = [...lines.reverse(), ...log].slice(0, 14);
	}

	function describeClear(clear: ClearReport) {
		const rows = clear.rows.length;
		const doubled = clear.multiplier > 1 ? ` (×${clear.multiplier}, chain open)` : '';
		const lines = [`${rows} row${rows === 1 ? '' : 's'} cleared: +${clear.rowPoints}${doubled}`];
		for (const event of clear.events) {
			switch (event.type) {
				case 'start':
					lines.push(`${event.codon} → Met (start)`);
					break;
				case 'add':
					lines.push(`${event.codon} → ${AMINO_ACIDS[event.aminoAcid].short}`);
					break;
				case 'complete':
					lines.push(`${event.codon} → stop: chain of ${event.chain.length} complete!`);
					break;
				case 'too-short':
					lines.push(`${event.codon} → stop: a lone Met isn't a chain`);
					break;
				case 'outside':
					lines.push(`${event.codon} (waiting for AUG)`);
					break;
			}
		}
		if (clear.chainPoints > 0) lines.push(`Chain bonus: +${clear.chainPoints}`);
		addLog(...lines);
	}

	function onKeydown(event: KeyboardEvent) {
		if (!mounted) return;

		if (!started) {
			if (event.key === 'Enter') {
				event.preventDefault();
				start();
			}
			return;
		}

		if (event.key === 'p') {
			if (!view.over) paused = !paused;
			return;
		}

		const action = KEYS[event.key];
		if (!action) return;
		event.preventDefault();
		act(action);
	}

	/** Pause automatically when the player switches to another tab or app. */
	function onVisibilityChange() {
		if (document.visibilityState === 'hidden' && started && !view.over) paused = true;
	}

	/** Draw the board and the piece in play. */
	function draw() {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;

		const scale = window.devicePixelRatio || 1;
		canvas.width = BOARD_PIXEL_WIDTH * scale;
		canvas.height = BOARD_PIXEL_HEIGHT * scale;
		context.setTransform(scale, 0, 0, scale, 0, 0);

		// Dark gaps between slots, with four slightly lighter lanes: one per codon slot.
		context.fillStyle = '#020617';
		context.fillRect(0, 0, BOARD_PIXEL_WIDTH, BOARD_PIXEL_HEIGHT);
		for (let slot = 0; slot < BOARD_WIDTH / 3; slot++) {
			context.fillStyle = '#0f172a';
			context.fillRect(columnX(slot * 3), 0, 3 * CELL, BOARD_PIXEL_HEIGHT);
			// Faint lines between the three columns inside a lane.
			context.fillStyle = '#1e293b';
			for (let i = 1; i < 3; i++) {
				context.fillRect(columnX(slot * 3) + i * CELL, 0, 1, BOARD_PIXEL_HEIGHT);
			}
		}

		if (!started) return;

		view.board.forEach((row, y) =>
			row.forEach((base, x) => {
				if (base) drawSquare(context, x, y, base);
			})
		);

		for (const mark of findMarks(view.board)) drawMark(context, mark, 1);

		const active = view.active;
		if (active) {
			// The ghost: where the piece will land, and any START or STOP it would make.
			const landed = drop(view.board, active);
			for (const { x, y, base } of landed.piece.squares) {
				drawGhostSquare(context, landed.x + x, landed.y + y, base);
			}
			for (const mark of previewMarks(view.board, landed)) drawMark(context, mark, 0.5);

			for (const { x, y, base } of active.piece.squares) {
				drawSquare(context, active.x + x, active.y + y, base);
			}
		}
	}

	function drawLetter(context: CanvasRenderingContext2D, x: number, y: number, base: Base) {
		context.font = `bold ${Math.round(CELL * 0.55)}px system-ui, sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(base, columnX(x) + CELL / 2, y * CELL + CELL / 2 + 1);
	}

	function drawSquare(context: CanvasRenderingContext2D, x: number, y: number, base: Base) {
		context.fillStyle = COLOURS[base];
		context.fillRect(columnX(x) + 1, y * CELL + 1, CELL - 2, CELL - 2);
		context.fillStyle = '#0f172a';
		drawLetter(context, x, y, base);
	}

	function drawGhostSquare(context: CanvasRenderingContext2D, x: number, y: number, base: Base) {
		context.save();
		context.globalAlpha = 0.4;
		context.strokeStyle = COLOURS[base];
		context.lineWidth = 2;
		context.strokeRect(columnX(x) + 2, y * CELL + 2, CELL - 4, CELL - 4);
		context.fillStyle = COLOURS[base];
		drawLetter(context, x, y, base);
		context.restore();
	}

	/** Outline a START or STOP codon slot with a coloured glow. */
	function drawMark(context: CanvasRenderingContext2D, mark: CodonMark, alpha: number) {
		const colour = MARK_COLOURS[mark.kind];
		context.save();
		context.globalAlpha = alpha;
		context.strokeStyle = colour;
		context.shadowColor = colour;
		context.shadowBlur = 10;
		context.lineWidth = 3;
		context.strokeRect(columnX(mark.slot * 3) + 1.5, mark.row * CELL + 1.5, 3 * CELL - 3, CELL - 3);
		context.restore();
	}

	// Redraw whenever the game changes.
	$effect(() => {
		void view;
		void started;
		draw();
	});

	// Tell the rest of the app whether a game is in progress.
	$effect(() => {
		playState.playing = started && !paused && !view.over;
		return () => {
			playState.playing = false;
		};
	});

	// The automatic fall, timed by the level.
	onMount(() => {
		mounted = true;
		let last = performance.now();
		let waited = 0;
		let frame = 0;

		function loop(now: number) {
			const elapsed = now - last;
			last = now;
			if (started && !paused && !game.state.over) {
				waited += elapsed;
				if (waited >= fallInterval(game.state.score.level)) {
					waited = 0;
					act('tick');
				}
			}
			frame = requestAnimationFrame(loop);
		}

		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});
</script>

<svelte:window onkeydown={onKeydown} />
<svelte:document onvisibilitychange={onVisibilityChange} />

{#snippet chips(codon: string)}
	<span class="inline-flex gap-0.5">
		{#each codon.split('') as base, index (index)}
			<span
				class="flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold text-slate-900"
				style:background-color={COLOURS[base as Base]}
			>
				{base}
			</span>
		{/each}
	</span>
{/snippet}

{#snippet pieceGrid(piece: Piece)}
	<div class="grid w-fit gap-0.5" style:grid-template-columns="repeat({piece.size}, 1.25rem)">
		{#each Array.from({ length: piece.size * piece.size }, (_, i) => i) as index (index)}
			{@const square = piece.squares.find(
				(s) => s.x === index % piece.size && s.y === Math.floor(index / piece.size)
			)}
			<div
				class="flex h-5 w-5 items-center justify-center text-xs font-bold text-slate-900"
				style:background-color={square ? COLOURS[square.base] : 'transparent'}
			>
				{square?.base ?? ''}
			</div>
		{/each}
	</div>
{/snippet}

<div class="flex flex-wrap items-start gap-6">
	<div>
		<!-- Goal bar: what to aim for right now, shown with coloured bases. -->
		<div
			class="mb-2 flex min-h-8 flex-wrap items-center justify-center gap-1 text-sm font-semibold"
			style:width="{BOARD_PIXEL_WIDTH}px"
		>
			{#if started && !view.over}
				{#if chainOpen}
					<span class="text-green-700">Chain ×2 · STOP:</span>
					{@render chips('UAA')}
					{@render chips('UAG')}
					{@render chips('UGA')}
				{:else}
					<span>Make</span>
					{@render chips('AUG')}
					<span>in one slot to START a chain</span>
				{/if}
			{/if}
		</div>

		<div
			class="relative transition-shadow"
			class:ring-4={chainOpen}
			class:ring-green-400={chainOpen}
		>
			<canvas
				bind:this={canvas}
				style:width="{BOARD_PIXEL_WIDTH}px"
				style:height="{BOARD_PIXEL_HEIGHT}px"
			>
				Game board. The score, next piece and chain are listed beside it.
			</canvas>

			{#if !started}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-white"
				>
					{#if mounted}
						<button
							type="button"
							class="rounded bg-white px-6 py-3 text-xl font-semibold text-slate-900"
							onclick={start}
						>
							Start
						</button>
						<p class="text-sm">or press Enter</p>
					{:else}
						<p>Loading…</p>
					{/if}
				</div>
			{:else if view.over}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-white"
				>
					<p class="text-2xl font-bold">Game over</p>
					<p>Score: {view.score.score}</p>
					<button
						type="button"
						class="rounded bg-white px-4 py-2 font-semibold text-slate-900"
						onclick={start}
					>
						Play again
					</button>
				</div>
			{:else if paused}
				<div class="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-white">
					<p class="text-xl font-bold">Paused: press P</p>
				</div>
			{/if}
		</div>
	</div>

	<aside class="flex w-64 flex-col gap-4">
		<dl class="grid grid-cols-2 gap-x-4 gap-y-1">
			<dt>Score</dt>
			<dd class="text-right font-mono">{view.score.score}</dd>
			<dt>Level</dt>
			<dd class="text-right font-mono">{view.score.level}</dd>
			<dt>Rows</dt>
			<dd class="text-right font-mono">{view.score.rows}</dd>
			<dt>Chains</dt>
			<dd class="text-right font-mono">{view.stats.chains}</dd>
		</dl>

		{#if started}
			<section>
				<h2 class="font-semibold">Next</h2>
				{@render pieceGrid(view.next)}
			</section>
		{/if}

		<section>
			<h2 class="font-semibold">Chain</h2>
			{#if view.translation.chain}
				<p class="font-mono text-sm">
					{view.translation.chain.map((aminoAcid) => AMINO_ACIDS[aminoAcid].short).join('–')}
				</p>
				{#if view.translation.chain.length >= 2}
					<p class="text-sm">
						Worth +{chainBonus(view.translation.chain.length, view.score.level)} if a stop comes now
					</p>
				{/if}
			{:else}
				<p class="text-sm">Waiting for AUG</p>
			{/if}
		</section>

		<section>
			<h2 class="font-semibold">Reading</h2>
			<ol class="font-mono text-sm">
				{#each log as line, index (index)}
					<li>{line}</li>
				{/each}
			</ol>
		</section>

		<section class="text-sm">
			<h2 class="font-semibold">Keys</h2>
			<p>← → move · ↓ soft drop · ↑ or X turn · Z turn back · Space drop · P pause</p>
		</section>
	</aside>
</div>
