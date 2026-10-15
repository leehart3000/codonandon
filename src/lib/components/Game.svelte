<script lang="ts">
	import { onMount } from 'svelte';
	import { APP } from '#lib/config.js';
	import { BOARD_HEIGHT, BOARD_WIDTH, drop } from '#lib/game/board.js';
	import { createGame, fallInterval, type Action, type ActionResult } from '#lib/game/game.js';
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

	/** Gesture tuning: a tap is shorter than this, and a flick faster than this (pixels per ms). */
	const TAP_TIME = 300;
	const FLICK_SPEED = 0.6;

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

	/** Scores with thousands separators, e.g. 12,340. */
	const formatNumber = (value: number) => value.toLocaleString('en-GB');

	let game = createGame({ seed: 1 });
	let view = $state.raw(game.state);
	/** True once the page's code is running, so buttons work when they appear. */
	let mounted = $state(false);
	let started = $state(false);
	let paused = $state(false);
	/** Whether tip cards and the goal bar appear during the game. */
	let showTips = $state(true);
	/** The tip card being shown, which pauses play until Continue. */
	let tip = $state<Tip | null>(null);
	/** Which "How to play" card is showing on the start screen, if any. */
	let howTo = $state<number | null>(null);
	let canvas: HTMLCanvasElement | undefined = $state();
	/** True on touch devices (phones, tablets): gestures and touch instructions. */
	let touch = $state(false);
	/** Size of one square in pixels, fitted to the screen. */
	let cell = $state(28);
	let viewportWidth = $state(1024);

	const boardPixelWidth = $derived(BOARD_WIDTH * cell);
	const boardPixelHeight = $derived(BOARD_HEIGHT * cell);
	/** On phones, the bars may be wider than the board, using the side space. */
	const barWidth = $derived(
		touch ? Math.max(boardPixelWidth, Math.min(viewportWidth - 16, 420)) : boardPixelWidth
	);

	const playing = $derived(started && !paused && !tip && !view.over);
	const chainOpen = $derived(started && !view.over && view.translation.chain !== null);

	/** What a stop codon would bank right now, if the chain is long enough. */
	const bankable = $derived(
		view.translation.chain && view.translation.chain.length >= 2
			? chainBonus(view.translation.chain.length, view.score.level)
			: null
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
		paused = false;
		howTo = null;
		started = true;
		tip = showTips ? (tipForLevel(1) ?? null) : null;
	}

	function act(action: Action): ActionResult | null {
		if (!playing) return null;
		const levelBefore = game.state.score.level;
		const result = game.act(action);
		view = game.state;
		if (showTips && !view.over && view.score.level > levelBefore) {
			tip = tipForLevel(view.score.level) ?? null;
		}
		return result;
	}

	/** Remember the "show tips" choice, and resize the board (the goal bar comes and goes with it). */
	function setShowTips(value: boolean) {
		showTips = value;
		fitBoard();
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

	/** The whole play area, which takes gestures. */
	let playArea: HTMLDivElement | undefined = $state();

	/**
	 * Touch gestures, anywhere in the play area (not on buttons or cards):
	 * drag sideways = move, drag down = move down (in any order, without lifting),
	 * flick down = drop, tap = turn clockwise, swipe up = turn anticlockwise.
	 * With a mouse, clicking the board pauses instead.
	 */
	let gesture: {
		id: number;
		startX: number;
		startY: number;
		/** Where the finger was when the piece last moved sideways / down. */
		anchorX: number;
		anchorY: number;
		time: number;
		moved: boolean;
		/** Recent finger positions, for measuring the speed of a flick. */
		samples: { x: number; y: number; t: number }[];
	} | null = null;

	function onPointerDown(event: PointerEvent) {
		const target = event.target as Element;
		if (target.closest('button, a, [role="dialog"]')) return;

		if (event.pointerType === 'mouse') {
			if (target === canvas) togglePause();
			return;
		}
		if (!playing) return;

		event.preventDefault();
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		const now = performance.now();
		gesture = {
			id: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			anchorX: event.clientX,
			anchorY: event.clientY,
			time: now,
			moved: false,
			samples: [{ x: event.clientX, y: event.clientY, t: now }]
		};
	}

	function onPointerMove(event: PointerEvent) {
		if (!gesture || event.pointerId !== gesture.id) return;
		const { clientX: x, clientY: y } = event;
		const now = performance.now();

		if (Math.hypot(x - gesture.startX, y - gesture.startY) > 10) gesture.moved = true;
		gesture.samples = [...gesture.samples, { x, y, t: now }].filter((s) => now - s.t < 120);

		// Which way is the finger mostly moving right now? Only that direction moves the piece,
		// so a slight sideways wobble during a downward drag or flick can't nudge it off course.
		const oldest = gesture.samples[0] ?? { x, y, t: now };
		const movingSideways = Math.abs(x - oldest.x) > Math.abs(y - oldest.y);

		if (movingSideways) {
			// One column for every square's width dragged.
			while (gesture && x - gesture.anchorX >= cell) {
				act('right');
				gesture.anchorX += cell;
			}
			while (gesture && gesture.anchorX - x >= cell) {
				act('left');
				gesture.anchorX -= cell;
			}
			// Ignore any up-and-down drift while moving sideways.
			if (gesture) gesture.anchorY = y;
		} else {
			// One row for every square's height dragged. Stop if the piece lands,
			// so the drag doesn't carry on into the next piece.
			while (gesture && y - gesture.anchorY >= cell) {
				if (act('down')?.locked) {
					gesture = null;
					return;
				}
				gesture.anchorY += cell;
			}
			// Moving back up resets the measure, so a later downward drag counts from there.
			if (gesture && y < gesture.anchorY) gesture.anchorY = y;
			// Ignore any sideways drift while moving down.
			if (gesture) gesture.anchorX = x;
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (!gesture || event.pointerId !== gesture.id) return;
		const { clientX: x, clientY: y } = event;
		const now = performance.now();
		const dx = x - gesture.startX;
		const dy = y - gesture.startY;

		// The finger's speed just before lifting decides whether this was a flick.
		const oldest = gesture.samples[0] ?? { x, y, t: now };
		const elapsed = Math.max(now - oldest.t, 1);
		const speedY = (y - oldest.y) / elapsed;
		const speedX = (x - oldest.x) / elapsed;

		if (!gesture.moved && now - gesture.time < TAP_TIME) {
			act('rotate-clockwise');
		} else if (speedY > FLICK_SPEED && speedY > Math.abs(speedX)) {
			act('drop');
		} else if (dy < -2 * cell && Math.abs(dy) > Math.abs(dx)) {
			act('rotate-anticlockwise');
		}
		gesture = null;
	}

	/** Pause automatically when the player switches to another tab or app. */
	function onVisibilityChange() {
		if (document.visibilityState === 'hidden' && started && !view.over) paused = true;
		gesture = null;
	}

	/** Fit the board to the screen, leaving room for the top bar (and the goal bar, if tips are on). */
	function fitBoard() {
		viewportWidth = window.innerWidth;
		const reserved = 44 + (showTips ? 44 : 0) + 24;
		const byHeight = Math.floor((window.innerHeight - reserved) / BOARD_HEIGHT);
		const byWidth = Math.floor((window.innerWidth - 16) / BOARD_WIDTH);
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
		context.font = `bold ${Math.round(cell * 0.6)}px system-ui, sans-serif`;
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
		playState.playing = playing;
		return () => {
			playState.playing = false;
		};
	});

	onMount(() => {
		mounted = true;
		touch = window.matchMedia('(pointer: coarse)').matches;

		// Restore the "show tips" choice, if this browser remembers one.
		try {
			showTips = localStorage.getItem(SHOW_TIPS_KEY) !== 'false';
		} catch {
			// Storage unavailable: keep the default (tips on).
		}
		fitBoard();

		// The automatic fall, timed by the level.
		let last = performance.now();
		let waited = 0;
		let frame = 0;

		function loop(now: number) {
			const elapsed = now - last;
			last = now;
			if (playing) {
				waited += elapsed;
				if (waited >= fallInterval(game.state.score.level)) {
					waited = 0;
					act('tick');
				}
			}
			frame = requestAnimationFrame(loop);
		}

		frame = requestAnimationFrame(loop);
		// While playing, stop iOS's own touch behaviour (magnifier, scrolling) in the play area,
		// except on buttons, links and cards, which must still work.
		function stopDefaultTouch(event: TouchEvent) {
			const target = event.target as Element;
			if (playing && !target.closest('button, a, [role="dialog"]')) event.preventDefault();
		}
		playArea?.addEventListener('touchstart', stopDefaultTouch, { passive: false });

		return () => {
			cancelAnimationFrame(frame);
			playArea?.removeEventListener('touchstart', stopDefaultTouch);
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
				class="flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold text-slate-900"
				style:background-color={COLOURS[base as Base]}
			>
				{base}
			</span>
		{/each}
	</span>
{/snippet}

{#snippet tipCard(card: Tip, buttonLabel: string, onContinue: () => void)}
	<div class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/90 p-3">
		<div
			role="dialog"
			aria-labelledby="tip-title"
			class="max-h-full overflow-y-auto rounded-lg bg-white p-4 text-slate-900 shadow-xl"
		>
			<p class="text-xs font-bold tracking-wide text-slate-500 uppercase">
				Tip {TIPS.findIndex((t) => t.level === card.level) + 1} of {TIPS.length}
			</p>
			<h2 id="tip-title" class="text-lg font-bold">{card.title}</h2>
			<p class="mt-1 text-sm">{card.text}</p>
			{#if card.codons}
				<p class="mt-2 flex flex-wrap gap-2">
					{#each card.codons as { codon, kind } (codon)}
						{@render chips(codon, kind)}
					{/each}
				</p>
			{/if}
			<button
				type="button"
				class="mt-3 min-h-11 rounded bg-slate-900 px-4 font-semibold text-white"
				onclick={onContinue}
			>
				{buttonLabel}
			</button>
			{#if !touch}
				<span class="ml-2 text-xs text-slate-500">or press Enter</span>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet tipsSwitch()}
	<button
		type="button"
		role="switch"
		aria-checked={showTips}
		class="flex min-h-11 items-center gap-3 text-sm"
		onclick={() => setShowTips(!showTips)}
	>
		<span
			class="relative h-7 w-12 shrink-0 rounded-full transition-colors {showTips
				? 'bg-green-500'
				: 'bg-slate-500'}"
		>
			<span
				class="absolute top-1 h-5 w-5 rounded-full bg-white transition-all {showTips
					? 'left-6'
					: 'left-1'}"
			></span>
		</span>
		Show tips in game
	</button>
{/snippet}

{#snippet pieceGrid(piece: Piece, size: number)}
	<span
		class="grid w-fit gap-px"
		style:grid-template-columns="repeat({piece.size}, {size}px)"
		aria-label="Next piece"
	>
		{#each Array.from({ length: piece.size * piece.size }, (_, i) => i) as index (index)}
			{@const square = piece.squares.find(
				(s) => s.x === index % piece.size && s.y === Math.floor(index / piece.size)
			)}
			<span
				style:width="{size}px"
				style:height="{size}px"
				style:background-color={square ? COLOURS[square.base] : 'transparent'}
			></span>
		{/each}
	</span>
{/snippet}

<!-- The whole play area takes gestures, so a swipe beside the board still controls the piece. -->
<div
	bind:this={playArea}
	class="flex min-h-dvh flex-wrap items-start justify-center gap-6 pt-1 select-none"
	style:touch-action={playing ? 'none' : 'auto'}
	style:-webkit-touch-callout="none"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={() => (gesture = null)}
	role="presentation"
>
	<div class="flex flex-col items-center">
		<!-- Top bar: wordmark, next piece, score and level (and a pause button on phones). -->
		<div class="flex h-11 items-center gap-3" style:width="{barWidth}px">
			<span class="text-lg font-black tracking-tight">{APP.name}</span>
			<span class="flex h-8 flex-1 items-center justify-center">
				{#if started && !paused && !view.over}
					{@render pieceGrid(view.next, 7)}
				{/if}
			</span>
			<span class="text-right leading-tight">
				<span class="block font-mono font-bold">{formatNumber(view.score.score)}</span>
				<span class="block text-[10px] uppercase opacity-70">{view.stats.chains} chains</span>
			</span>
			<span class="text-right leading-tight">
				<span class="block font-mono font-bold">Lv {view.score.level}</span>
				<span class="block text-[10px] uppercase opacity-70">{view.score.rows} rows</span>
			</span>
			{#if touch}
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-900 disabled:opacity-30"
					onclick={togglePause}
					disabled={!started || view.over || !!tip}
					aria-label={paused ? 'Resume game' : 'Pause game'}
				>
					<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
						{#if paused}
							<path d="M8 5v14l11-7z" />
						{:else}
							<path d="M7 5h4v14H7zM13 5h4v14h-4z" />
						{/if}
					</svg>
				</button>
			{/if}
		</div>

		<!-- Goal bar: what to aim for right now. Shown with tips; fixed height, so the board never jumps. -->
		{#if showTips && started}
			<div
				class="flex h-11 flex-col items-center justify-center gap-1 text-center text-xs font-bold tracking-wide whitespace-nowrap uppercase"
				style:width="{barWidth}px"
			>
				{#if started && !view.over}
					{#if chainOpen}
						<p class="text-green-700">
							Chain ×2{bankable !== null ? ` · stop now: +${formatNumber(bankable)}` : ''}
						</p>
						<p class="flex items-center gap-1.5">
							{@render chips('UAA', 'stop')}
							{@render chips('UAG', 'stop')}
							{@render chips('UGA', 'stop')}
						</p>
					{:else if startReady}
						<p class="text-green-700">Start codon ready!</p>
						<p>Clear its row to start a chain</p>
					{:else}
						<p>Form a start codon</p>
						<p class="flex items-center gap-1.5">
							{@render chips('AUG', 'start')}
							<span>anywhere in a row</span>
						</p>
					{/if}
				{/if}
			</div>
		{/if}

		<div
			class="relative mt-1 transition-shadow"
			class:ring-4={chainOpen}
			class:ring-green-400={chainOpen}
		>
			<canvas
				bind:this={canvas}
				style:width="{boardPixelWidth}px"
				style:height="{boardPixelHeight}px"
			>
				Game board. The score, level and next piece are shown above it.
			</canvas>

			{#if !started}
				{@const card = howTo === null ? undefined : TIPS[howTo]}
				{#if card && howTo !== null}
					{@render tipCard(card, howTo + 1 < TIPS.length ? 'Next' : 'Done', nextHowTo)}
				{:else}
					<div
						class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 p-4 text-center text-white"
					>
						{#if mounted}
							<button
								type="button"
								class="rounded bg-white px-8 py-3 text-xl font-semibold text-slate-900"
								onclick={start}
							>
								Start
							</button>
							<div class="flex flex-col items-center">
								<button
									type="button"
									class="min-h-11 text-sm underline"
									onclick={() => (howTo = 0)}
								>
									Game tips
								</button>
								{@render tipsSwitch()}
							</div>
							<p class="text-xs opacity-80">
								{#if touch}
									Drag to move · Tap to turn · Swipe up to turn back · Flick down to drop
								{:else}
									← → move · ↓ down · ↑ or X turn · Z turn back · Space drop · P or click the board
									to pause · Enter to start
								{/if}
							</p>
							<a
								class="text-xs opacity-80"
								href={APP.sourceUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								Source code (AGPL-3.0) <span aria-hidden="true">↗</span><span class="sr-only">
									(opens in a new tab)</span
								>
							</a>
						{:else}
							<p>Loading…</p>
						{/if}
					</div>
				{/if}
			{:else if tip}
				{@render tipCard(tip, 'Continue', () => (tip = null))}
			{:else if view.over}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-white"
				>
					<p class="text-2xl font-bold">Game over</p>
					<p>Score: {formatNumber(view.score.score)}</p>
					<button
						type="button"
						class="min-h-11 rounded bg-white px-6 font-semibold text-slate-900"
						onclick={start}
					>
						Play again
					</button>
					{@render tipsSwitch()}
				</div>
			{:else if paused}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-white"
				>
					<p class="text-xl font-bold">Paused</p>
					<button
						type="button"
						class="min-h-11 rounded bg-white px-6 font-semibold text-slate-900"
						onclick={togglePause}
					>
						Resume
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Chain details for wide screens, once a game has started. -->
	{#if started}
		<aside class="hidden w-64 flex-col gap-2 pt-24 lg:flex">
			<h2 class="font-semibold">Chain</h2>
			{#if view.translation.chain}
				<p class="font-mono text-sm">
					{view.translation.chain.map((aminoAcid) => AMINO_ACIDS[aminoAcid].short).join('–')}
				</p>
				{#if bankable !== null}
					<p class="text-sm">Worth +{formatNumber(bankable)} if a stop comes now</p>
				{/if}
			{:else}
				<p class="text-sm">No chain yet</p>
			{/if}
		</aside>
	{/if}
</div>
