<script lang="ts">
	import { onMount } from 'svelte';
	import { BOARD_HEIGHT, BOARD_WIDTH } from '#lib/game/board.js';
	import { createGame, fallInterval, type Action, type ClearReport } from '#lib/game/game.js';
	import type { Piece } from '#lib/game/pieces.js';
	import { AMINO_ACIDS, type Base } from '#lib/genetics/genetic-code.js';
	import { playState } from '#lib/play-state.svelte.js';

	/** Size of one square, in pixels. */
	const CELL = 28;

	/** Base colours, matching the icon: A green, U red, G gold, C blue. */
	const COLOURS: Record<Base, string> = {
		A: '#7ec98f',
		U: '#d97878',
		G: '#e3be71',
		C: '#7aa8d6'
	};

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
		const lines = [`${rows} row${rows === 1 ? '' : 's'} cleared: +${clear.rowPoints}`];
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
		canvas.width = BOARD_WIDTH * CELL * scale;
		canvas.height = BOARD_HEIGHT * CELL * scale;
		context.setTransform(scale, 0, 0, scale, 0, 0);

		context.fillStyle = '#0f172a';
		context.fillRect(0, 0, BOARD_WIDTH * CELL, BOARD_HEIGHT * CELL);

		// Faint lines between columns, slightly brighter between codons (every 3 columns).
		for (let column = 1; column < BOARD_WIDTH; column++) {
			context.fillStyle = column % 3 === 0 ? '#334155' : '#1e293b';
			context.fillRect(column * CELL, 0, 1, BOARD_HEIGHT * CELL);
		}

		if (!started) return;

		view.board.forEach((row, y) =>
			row.forEach((base, x) => {
				if (base) drawSquare(context, x, y, base);
			})
		);

		const active = view.active;
		if (active) {
			for (const { x, y, base } of active.piece.squares) {
				drawSquare(context, active.x + x, active.y + y, base);
			}
		}
	}

	function drawSquare(context: CanvasRenderingContext2D, x: number, y: number, base: Base) {
		context.fillStyle = COLOURS[base];
		context.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
		context.fillStyle = '#0f172a';
		context.font = `bold ${Math.round(CELL * 0.55)}px system-ui, sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(base, x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
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
	<div class="relative">
		<canvas
			bind:this={canvas}
			style:width="{BOARD_WIDTH * CELL}px"
			style:height="{BOARD_HEIGHT * CELL}px"
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
			<p class="font-mono text-sm">
				{#if view.translation.chain}
					{view.translation.chain.map((aminoAcid) => AMINO_ACIDS[aminoAcid].short).join('–')}
				{:else}
					Waiting for AUG
				{/if}
			</p>
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
