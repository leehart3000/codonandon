<script lang="ts">
	import { onMount } from 'svelte';
	import { BOARD_HEIGHT, BOARD_WIDTH, drop } from '#lib/game/board.js';
	import { createGame, fallInterval, type Action, type ClearReport } from '#lib/game/game.js';
	import {
		findMarks,
		findOpportunities,
		previewMarks,
		type CodonMark
	} from '#lib/game/highlights.js';
	import type { Piece } from '#lib/game/pieces.js';
	import { chainBonus } from '#lib/game/scoring.js';
	import { TIPS, tipForLevel, type Tip } from '#lib/game/tips.js';
	import { AMINO_ACIDS, type Base } from '#lib/genetics/genetic-code.js';
	import { playState } from '#lib/play-state.svelte.js';

	/** Base colours, matching the icon: A green, U red, G gold, C blue. */
	const COLOURS: Record<Base, string> = {
		A: '#7ec98f',
		U: '#d97878',
		G: '#e3be71',
		C: '#7aa8d6'
	};

	/** START glows green, STOP glows orange (banking a chain is good news). */
	const MARK_COLOURS = { start: '#4ade80', stop: '#fb923c' } as const;
	/** Opportunities: cyan for forming a START, orange for forming a STOP. */
	const OPPORTUNITY_COLOURS = { start: '#22d3ee', stop: '#fb923c' } as const;

	/** Where the "show tips" choice is remembered in this browser. */
	const SHOW_TIPS_KEY = 'showTips';

	/** Smallest and largest square size, in pixels. */
	const MIN_CELL = 14;
	const MAX_CELL = 32;

	const KEYS: Record<string, Action> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowDown: 'down',
		ArrowUp: 'rotate-clockwise',
		x: 'rotate-clockwise',
		z: 'rotate-anticlockwise',
		' ': 'drop'
	};

	/** Actions that ignore a held-down key repeating, so one press is one drop or one turn. */
	const NO_REPEAT: Action[] = ['drop', 'rotate-clockwise', 'rotate-anticlockwise'];

	/** A fresh random seed for each new game. */
	const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

	let game = createGame({ seed: 1 });
	let view = $state.raw(game.state);
	/** True once the page's code is running, so buttons work when they appear. */
	let mounted = $state(false);
	let started = $state(false);
	let paused = $state(false);
	/** Whether tip cards appear during the game. */
	let showTips = $state(true);
	/** The tip card being shown, which pauses play until Continue. */
	let tip = $state<Tip | null>(null);
	/** Which "How to play" card is showing on the start screen, if any. */
	let howTo = $state<number | null>(null);
	let log = $state<string[]>([]);
	let canvas: HTMLCanvasElement | undefined = $state();
	/** True on touch devices (phones, tablets): shows the on-screen buttons. */
	let touch = $state(false);
	/** Size of one square in pixels, fitted to the screen. */
	let cell = $state(28);

	const boardPixelWidth = $derived(BOARD_WIDTH * cell);
	const boardPixelHeight = $derived(BOARD_HEIGHT * cell);

	const chainOpen = $derived(started && !view.over && view.translation.chain !== null);

	/** The goal bar's first line while a chain is open, including what a stop would bank now. */
	const chainHeadline = $derived(
		view.translation.chain && view.translation.chain.length >= 2
			? `Chain started · rows ×2 · stop: +${chainBonus(view.translation.chain.length, view.score.level)}`
			: 'Chain started · rows ×2'
	);

	/** An AUG is placed on the board, but its row hasn't been cleared yet. */
	const startReady = $derived(
		started &&
			!view.over &&
			!chainOpen &&
			findMarks(view.board, view.translation).some((mark) => mark.kind === 'start')
	);

	/** Where the falling piece could form a START (or, with a chain open, a STOP). */
	const opportunities = $derived(
		started && !view.over && view.active
			? findOpportunities(view.board, view.active.piece, view.translation)
			: { kind: 'start' as const, cells: [], squares: [] }
	);

	/** Start a new game with a fresh seed, opening with the first tip if tips are on. */
	function start() {
		game = createGame({ seed: randomSeed() });
		view = game.state;
		log = [];
		paused = false;
		howTo = null;
		started = true;
		tip = showTips ? (tipForLevel(1) ?? null) : null;
	}

	function act(action: Action) {
		if (!started || paused || tip) return;
		const levelBefore = game.state.score.level;
		const result = game.act(action);
		view = game.state;
		if (result.clear) describeClear(result.clear);
		if (result.gameOver && result.gameOver.unfinishedPoints > 0) {
			addLog(`Unfinished chain: +${result.gameOver.unfinishedPoints}`);
		}
		if (showTips && !view.over && view.score.level > levelBefore) {
			tip = tipForLevel(view.score.level) ?? null;
		}
	}

	/** Assist offered on tip cards: carry on with an empty board. */
	function continueWithClearBoard() {
		game.clearBoard();
		view = game.state;
		tip = null;
	}

	/** Remember the "show tips" choice in this browser. */
	function setShowTips(value: boolean) {
		showTips = value;
		try {
			localStorage.setItem(SHOW_TIPS_KEY, String(value));
		} catch {
			// Storage can be unavailable (e.g. private browsing); the choice just isn't remembered.
		}
	}

	/** Step through the "How to play" cards, closing after the last one. */
	function nextHowTo() {
		if (howTo === null) return;
		howTo = howTo + 1 < TIPS.length ? howTo + 1 : null;
	}

	function togglePause() {
		if (started && !view.over && !tip) paused = !paused;
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
			}
		}
		if (clear.chainPoints > 0) lines.push(`Chain bonus: +${clear.chainPoints}`);
		addLog(...lines);
	}

	function onKeydown(event: KeyboardEvent) {
		if (!mounted) return;

		// Cards: Enter continues. Space is the drop key, so it never skips a card.
		if (tip) {
			if (event.key === 'Enter') {
				event.preventDefault();
				tip = null;
			}
			return;
		}
		if (howTo !== null) {
			if (event.key === 'Enter') {
				event.preventDefault();
				nextHowTo();
			} else if (event.key === 'Escape') {
				howTo = null;
			}
			return;
		}

		if (!started) {
			if (event.key === 'Enter') {
				event.preventDefault();
				start();
			}
			return;
		}

		if (event.key === 'p') {
			togglePause();
			return;
		}

		const action = KEYS[event.key];
		if (!action) return;
		event.preventDefault();
		if (event.repeat && NO_REPEAT.includes(action)) return;
		act(action);
	}

	// Touch buttons: holding left, right or down repeats, like holding a key.
	let repeatTimer: ReturnType<typeof setTimeout> | undefined;

	function press(event: PointerEvent, action: Action) {
		event.preventDefault();
		act(action);
		stopRepeat();
		if (NO_REPEAT.includes(action)) return;
		repeatTimer = setTimeout(function again() {
			act(action);
			repeatTimer = setTimeout(again, 80);
		}, 220);
	}

	function stopRepeat() {
		clearTimeout(repeatTimer);
		repeatTimer = undefined;
	}

	/** Pause automatically when the player switches to another tab or app. */
	function onVisibilityChange() {
		if (document.visibilityState === 'hidden' && started && !view.over) paused = true;
		stopRepeat();
	}

	/** Fit the board to the screen, leaving room for the bars and touch buttons. */
	function fitBoard() {
		const reserved = 64 + 48 + (touch ? 136 : 0) + 24 + (window.innerWidth >= 640 ? 72 : 0);
		const byHeight = Math.floor((window.innerHeight - reserved) / BOARD_HEIGHT);
		const byWidth = Math.floor((window.innerWidth - 32) / BOARD_WIDTH);
		cell = Math.max(MIN_CELL, Math.min(MAX_CELL, byHeight, byWidth));
	}

	/** Draw the board and the piece in play. */
	function draw() {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;

		const scale = window.devicePixelRatio || 1;
		canvas.width = boardPixelWidth * scale;
		canvas.height = boardPixelHeight * scale;
		context.setTransform(scale, 0, 0, scale, 0, 0);

		// The board turns deep green while a chain is open: noticeable without reading.
		context.fillStyle = chainOpen ? '#052e1c' : '#0f172a';
		context.fillRect(0, 0, boardPixelWidth, boardPixelHeight);

		if (!started) return;

		view.board.forEach((row, y) =>
			row.forEach((base, x) => {
				if (base) drawSquare(context, x, y, base);
			})
		);

		for (const mark of findMarks(view.board, view.translation)) drawMark(context, mark, 1);
		for (const square of opportunities.cells) drawOutline(context, square.column, square.row);

		const active = view.active;
		if (active) {
			// The ghost: where the piece will land, and any START or STOP it would make.
			const landed = drop(view.board, active);
			for (const { x, y, base } of landed.piece.squares) {
				drawGhostSquare(context, landed.x + x, landed.y + y, base);
			}
			for (const mark of previewMarks(view.board, landed, view.translation)) {
				drawMark(context, mark, 0.5);
			}

			for (const { x, y, base } of active.piece.squares) {
				drawSquare(context, active.x + x, active.y + y, base);
			}
			for (const index of opportunities.squares) {
				const square = active.piece.squares[index];
				if (square) drawOutline(context, active.x + square.x, active.y + square.y);
			}
		}
	}

	function drawLetter(context: CanvasRenderingContext2D, x: number, y: number, base: Base) {
		context.font = `bold ${Math.round(cell * 0.55)}px system-ui, sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(base, x * cell + cell / 2, y * cell + cell / 2 + 1);
	}

	function drawSquare(context: CanvasRenderingContext2D, x: number, y: number, base: Base) {
		context.fillStyle = COLOURS[base];
		context.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
		context.fillStyle = '#0f172a';
		drawLetter(context, x, y, base);
	}

	function drawGhostSquare(context: CanvasRenderingContext2D, x: number, y: number, base: Base) {
		context.save();
		context.globalAlpha = 0.2;
		context.strokeStyle = COLOURS[base];
		context.lineWidth = 2;
		context.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
		context.fillStyle = COLOURS[base];
		drawLetter(context, x, y, base);
		context.restore();
	}

	/** Outline three squares (a START or STOP codon) with a coloured glow. */
	function drawMark(context: CanvasRenderingContext2D, mark: CodonMark, alpha: number) {
		const colour = MARK_COLOURS[mark.kind];
		context.save();
		context.globalAlpha = alpha;
		context.strokeStyle = colour;
		context.shadowColor = colour;
		context.shadowBlur = 10;
		context.lineWidth = 3;
		context.strokeRect(mark.column * cell + 1.5, mark.row * cell + 1.5, 3 * cell - 3, cell - 3);
		context.restore();
	}

	/** A glow around one square that is part of an opportunity: cyan for START, orange for STOP. */
	function drawOutline(context: CanvasRenderingContext2D, x: number, y: number) {
		const colour = OPPORTUNITY_COLOURS[opportunities.kind];
		context.save();
		context.strokeStyle = colour;
		context.shadowColor = colour;
		context.shadowBlur = 8;
		context.lineWidth = 2.5;
		context.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
		context.restore();
	}

	// Redraw whenever the game or the square size changes.
	$effect(() => {
		void view;
		void started;
		void cell;
		draw();
	});

	// Tell the rest of the app whether a game is in progress.
	$effect(() => {
		playState.playing = started && !paused && !tip && !view.over;
		return () => {
			playState.playing = false;
		};
	});

	onMount(() => {
		mounted = true;
		touch = window.matchMedia('(pointer: coarse)').matches;
		fitBoard();

		// Restore the "show tips" choice, if this browser remembers one.
		try {
			showTips = localStorage.getItem(SHOW_TIPS_KEY) !== 'false';
		} catch {
			// Storage unavailable: keep the default (tips on).
		}

		// The automatic fall, timed by the level.
		let last = performance.now();
		let waited = 0;
		let frame = 0;

		function loop(now: number) {
			const elapsed = now - last;
			last = now;
			if (started && !paused && !tip && !game.state.over) {
				waited += elapsed;
				if (waited >= fallInterval(game.state.score.level)) {
					waited = 0;
					act('tick');
				}
			}
			frame = requestAnimationFrame(loop);
		}

		frame = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(frame);
			stopRepeat();
		};
	});
</script>

<svelte:window onkeydown={onKeydown} onresize={fitBoard} />
<svelte:document onvisibilitychange={onVisibilityChange} />

{#snippet chips(codon: string, kind: 'start' | 'stop')}
	<span
		class="inline-flex gap-0.5 rounded p-0.5 ring-2"
		class:ring-green-400={kind === 'start'}
		class:ring-orange-400={kind === 'stop'}
	>
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

{#snippet tipCard(
	card: Tip,
	buttonLabel: string,
	onContinue: () => void,
	onClearBoard: (() => void) | null
)}
	<div class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/90 p-4">
		<div
			role="dialog"
			aria-labelledby="tip-title"
			class="max-h-full overflow-y-auto rounded-lg bg-white p-5 text-slate-900 shadow-xl"
		>
			<p class="text-xs font-bold tracking-wide text-slate-500 uppercase">
				Tip {TIPS.findIndex((t) => t.level === card.level) + 1} of {TIPS.length} · Level {card.level}
			</p>
			<h2 id="tip-title" class="text-xl font-bold">{card.title}</h2>
			<p class="mt-2 text-sm">{card.text}</p>
			{#if card.codons}
				<p class="mt-3 flex flex-wrap gap-2">
					{#each card.codons as { codon, kind } (codon)}
						{@render chips(codon, kind)}
					{/each}
				</p>
			{/if}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="rounded bg-slate-900 px-4 py-2 font-semibold text-white"
					onclick={onContinue}
				>
					{buttonLabel}
				</button>
				{#if onClearBoard}
					<button
						type="button"
						class="rounded border border-slate-900 px-4 py-2 font-semibold"
						onclick={onClearBoard}
					>
						Continue with a clear board
					</button>
				{/if}
			</div>
			{#if !touch}
				<p class="mt-2 text-xs text-slate-500">Enter = {buttonLabel}</p>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet tipsToggle()}
	<label class="flex items-center gap-2 text-sm">
		<input
			type="checkbox"
			checked={showTips}
			onchange={(event) => setShowTips(event.currentTarget.checked)}
		/>
		Show tips in game
	</label>
{/snippet}

{#snippet pieceGrid(piece: Piece, size: number)}
	<div
		class="grid w-fit gap-px"
		style:grid-template-columns="repeat({piece.size}, {size}px)"
		aria-label="Next piece"
	>
		{#each Array.from({ length: piece.size * piece.size }, (_, i) => i) as index (index)}
			{@const square = piece.squares.find(
				(s) => s.x === index % piece.size && s.y === Math.floor(index / piece.size)
			)}
			<div
				class="flex items-center justify-center font-bold text-slate-900"
				style:width="{size}px"
				style:height="{size}px"
				style:font-size="{Math.round(size * 0.6)}px"
				style:background-color={square ? COLOURS[square.base] : 'transparent'}
			>
				{square?.base ?? ''}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet touchButton(label: string, symbol: string, action: Action)}
	<button
		type="button"
		aria-label={label}
		class="flex h-14 touch-manipulation items-center justify-center rounded-lg bg-slate-800 text-2xl font-bold text-white select-none active:bg-slate-600"
		onpointerdown={(event) => press(event, action)}
		onpointerup={stopRepeat}
		onpointerleave={stopRepeat}
		onpointercancel={stopRepeat}
		oncontextmenu={(event) => event.preventDefault()}
	>
		{symbol}
	</button>
{/snippet}

<div class="flex flex-wrap items-start justify-center gap-6 lg:justify-start">
	<div>
		<!-- Goal bar: what to aim for right now. Fixed height, so the board never jumps. -->
		<div
			class="mb-1 flex h-16 flex-col items-center justify-center gap-1.5 text-center font-bold tracking-wide uppercase"
			style:width="{boardPixelWidth}px"
		>
			{#if started && !view.over}
				{#if chainOpen}
					<p class="text-sm text-green-700">{chainHeadline}</p>
					<p class="flex items-center gap-2 text-xs">
						<span>Stop codons:</span>
						{@render chips('UAA', 'stop')}
						{@render chips('UAG', 'stop')}
						{@render chips('UGA', 'stop')}
					</p>
				{:else if startReady}
					<p class="text-green-700">Start codon ready!</p>
					<p class="text-xs">Clear its row to start a chain</p>
				{:else}
					<p>Form a start codon</p>
					<p class="flex items-center gap-2 text-xs">
						{@render chips('AUG', 'start')}
						<span>anywhere in a row</span>
					</p>
				{/if}
			{/if}
		</div>

		<!-- Score bar: score, level, next piece and pause, on every screen size. -->
		<div
			class="mb-2 flex h-10 items-center justify-between gap-2 text-sm"
			style:width="{boardPixelWidth}px"
		>
			<span>Score <strong class="font-mono">{view.score.score}</strong></span>
			<span>Level <strong class="font-mono">{view.score.level}</strong></span>
			<span class="flex items-center gap-1">
				Next
				{#if started && !paused && !view.over}
					{@render pieceGrid(view.next, 9)}
				{/if}
			</span>
			<button
				type="button"
				class="rounded bg-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
				onclick={togglePause}
				disabled={!started || view.over || !!tip}
				aria-label={paused ? 'Resume' : 'Pause'}
			>
				{paused ? '▶' : '⏸'}
			</button>
		</div>

		<div
			class="relative transition-shadow"
			class:ring-4={chainOpen}
			class:ring-green-400={chainOpen}
		>
			<canvas
				bind:this={canvas}
				style:width="{boardPixelWidth}px"
				style:height="{boardPixelHeight}px"
			>
				Game board. The score, next piece and chain are listed beside it.
			</canvas>

			{#if !started}
				{@const card = howTo === null ? undefined : TIPS[howTo]}
				{#if card && howTo !== null}
					{@render tipCard(card, howTo + 1 < TIPS.length ? 'Next' : 'Done', nextHowTo, null)}
				{:else}
					<div
						class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-white"
					>
						{#if mounted}
							<button type="button" class="text-sm underline" onclick={() => (howTo = 0)}>
								How to play
							</button>
							<button
								type="button"
								class="rounded bg-white px-6 py-3 text-xl font-semibold text-slate-900"
								onclick={start}
							>
								Start
							</button>
							{#if !touch}
								<p class="text-sm">or press Enter</p>
							{/if}
							{@render tipsToggle()}
						{:else}
							<p>Loading…</p>
						{/if}
					</div>
				{/if}
			{:else if tip}
				{@render tipCard(
					tip,
					'Continue',
					() => (tip = null),
					tip.level > 1 ? continueWithClearBoard : null
				)}
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
					{@render tipsToggle()}
				</div>
			{:else if paused}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-white"
				>
					<p class="text-xl font-bold">Paused</p>
					<button
						type="button"
						class="rounded bg-white px-4 py-2 font-semibold text-slate-900"
						onclick={togglePause}
					>
						Resume
					</button>
					{#if !touch}
						<p class="text-sm">or press P</p>
					{/if}
				</div>
			{/if}
		</div>

		{#if touch}
			<!-- Touch controls: turns and drop on top, moves underneath. -->
			<div class="mt-3 grid grid-cols-3 gap-2" style:width="{boardPixelWidth}px">
				{@render touchButton('Turn anticlockwise', '⟲', 'rotate-anticlockwise')}
				{@render touchButton('Drop', 'DROP', 'drop')}
				{@render touchButton('Turn clockwise', '⟳', 'rotate-clockwise')}
				{@render touchButton('Move left', '←', 'left')}
				{@render touchButton('Move down', '↓', 'down')}
				{@render touchButton('Move right', '→', 'right')}
			</div>
		{/if}
	</div>

	<!-- Details for wide screens only; phones have no room for them. -->
	<aside class="hidden w-64 flex-col gap-4 lg:flex">
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
				<p class="text-sm">No chain yet</p>
			{/if}
			<p class="mt-1 text-sm">Rows {view.score.rows} · Chains {view.stats.chains}</p>
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
