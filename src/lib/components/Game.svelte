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
	import { AMINO_ACIDS, type AminoAcid, type Base } from '#lib/genetics/genetic-code.js';
	import { playState } from '#lib/play-state.svelte.js';
	import { redundancyHighlight, summariseAminoAcids } from '#lib/game/summary.js';
	import { describeLength } from '#lib/genetics/peptides.js';
	import { getTurnstileToken } from '#lib/turnstile-client.js';
	import { version } from '$app/env';
	import HighScores from '#lib/components/HighScores.svelte';

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

	/** Where the player's initials are remembered in this browser. */
	const INITIALS_KEY = 'initials';

	/** Turnstile site key: Cloudflare's always-pass invisible test key on the dev server. */
	const TURNSTILE_SITE_KEY = import.meta.env.DEV
		? '1x00000000000000000000BB'
		: APP.turnstileSiteKey;

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
	let showTips = $state(false);
	/** The tips setting for the game in progress: changes to the switch apply from the next game. */
	let tipsThisGame = $state(true);
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
	/** Points added at game over for an unfinished chain, shown on the stats screen. */
	let finalBonus = $state(0);
	/** Saving a score at game over. */
	let initials = $state('');
	let saving = $state(false);
	let saveError = $state('');
	let savedRank = $state<number | null>(null);
	/** The database ID of the just-saved score, for highlighting it in the table. */
	let savedId = $state<number | null>(null);
	/** Gameplay stats for the Stats page. */
	let piecesPlaced = $state(0);
	let bestClear = $state(0);
	let gameTime = $state(0);
	/** Whether the high-score table is showing. */
	let showScores = $state(false);
	/** Whether the game-over Stats page is showing. */
	let showStats = $state(false);
	/** Which home screen page is showing when no game is running. */
	let screen = $state<'home' | 'instructions' | 'settings'>('home');
	/** Asking "Quit this game?" on the pause screen. */
	let confirmQuit = $state(false);
	let turnstileBox: HTMLDivElement | undefined = $state();
	/** When the current game started, and how long it lasted (for the server's speed check). */
	let startedAt = 0;
	let durationMs = 0;

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

	/** The game-over summary: amino acids made, and one fact about codon redundancy. */
	const aminoSummary = $derived(view.over ? summariseAminoAcids(view.stats) : []);
	const redundancyFact = $derived(redundancyHighlight(aminoSummary));
	/** All 20 amino acids, for the "collected" display on the game-over screen. */
	const ALL_AMINO_ACIDS = Object.keys(AMINO_ACIDS) as AminoAcid[];
	const collected = $derived(
		ALL_AMINO_ACIDS.filter((aminoAcid) => view.stats.aminoAcids[aminoAcid])
	);
	/** The longest chain for display: up to 24 amino acids, then a count of the rest. */
	const longestShown = $derived(
		view.stats.longestChainSequence.slice(0, 24).map((a) => AMINO_ACIDS[a].short)
	);
	const longestMore = $derived(Math.max(0, view.stats.longestChainSequence.length - 24));
	/** A game's length as minutes and seconds, e.g. 4:32. */
	const formatTime = (ms: number) => {
		const seconds = Math.round(ms / 1000);
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	};

	/** Start a new game with a fresh seed, opening with the first tip if tips are on. */
	function start() {
		game = createGame({ seed: randomSeed() });
		view = game.state;
		paused = false;
		finalBonus = 0;
		saving = false;
		saveError = '';
		savedRank = null;
		savedId = null;
		piecesPlaced = 0;
		bestClear = 0;
		gameTime = 0;
		showScores = false;
		showStats = false;
		startedAt = performance.now();
		howTo = null;
		started = true;
		tipsThisGame = showTips;
		fitBoard();
		tip = tipsThisGame ? (tipForLevel(1) ?? null) : null;
	}

	function act(action: Action): ActionResult | null {
		if (!playing) return null;
		const levelBefore = game.state.score.level;
		const result = game.act(action);
		view = game.state;
		if (result.locked) piecesPlaced++;
		if (result.clear) bestClear = Math.max(bestClear, result.clear.rows.length);
		if (result.gameOver) {
			finalBonus = result.gameOver.unfinishedPoints;
			durationMs = Math.round(performance.now() - startedAt);
			gameTime = durationMs;
		}
		if (tipsThisGame && !view.over && view.score.level > levelBefore) {
			tip = tipForLevel(view.score.level) ?? null;
		}
		return result;
	}

	/** Remember the "show tips" choice, and resize the board (the goal bar comes and goes with it). */
	function setShowTips(value: boolean) {
		showTips = value;
		// Only resize on the start screen; during or after a game, it applies from the next game.
		if (!started) fitBoard();
		try {
			localStorage.setItem(SHOW_TIPS_KEY, String(value));
		} catch {
			// Storage can be unavailable (e.g. private browsing); the choice just isn't remembered.
		}
	}

	/** Send the score to the high-score table, after the invisible "are you human?" check. */
	async function saveScore(event: SubmitEvent) {
		event.preventDefault();
		const clean = initials.trim().toUpperCase();
		if (!/^[A-Z. ]{1,3}$/.test(clean) || !/[A-Z]/.test(clean)) {
			saveError = 'Please enter 1 to 3 letters (spaces and full stops are fine too).';
			return;
		}
		if (!turnstileBox || saving) return;

		saving = true;
		saveError = '';
		try {
			const turnstileToken = await getTurnstileToken(TURNSTILE_SITE_KEY, turnstileBox);
			const response = await fetch('/api/scores', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					initials: clean,
					score: view.score.score,
					level: view.score.level,
					rows: view.score.rows,
					chains: view.stats.chains,
					longestChain: view.stats.longestChain,
					durationMs,
					generatorVersion: view.generatorVersion,
					tips: tipsThisGame,
					offline: false,
					turnstileToken
				})
			});
			const result = (await response.json()) as { id?: number; rank?: number; error?: string };
			if (response.ok && result.rank) {
				savedRank = result.rank;
				savedId = result.id ?? null;
				showScores = true;
				try {
					localStorage.setItem(INITIALS_KEY, clean);
				} catch {
					// Not remembered; that's fine.
				}
			} else {
				saveError = result.error ?? 'Sorry, the score could not be saved.';
			}
		} catch (error) {
			saveError = !navigator.onLine
				? "You're offline, so the score can't be saved right now."
				: error instanceof Error
					? error.message
					: 'Sorry, the score could not be saved.';
		} finally {
			saving = false;
		}
	}

	/** Step through the "How to play" cards, closing after the last one. */
	function nextHowTo() {
		if (howTo === null) return;
		howTo = howTo + 1 < TIPS.length ? howTo + 1 : null;
	}

	function togglePause() {
		if (started && !view.over && !tip) {
			paused = !paused;
			confirmQuit = false;
		}
	}

	/** Leave the current game (or the game-over screen) and return to the home screen. */
	function goHome() {
		started = false;
		paused = false;
		tip = null;
		howTo = null;
		confirmQuit = false;
		showScores = false;
		showStats = false;
		screen = 'home';
	}

	function onKeydown(event: KeyboardEvent) {
		if (!mounted) return;

		// Typing in a box (such as initials) goes to the box, not the game.
		if (event.target instanceof HTMLInputElement) return;

		// The high-score table: Escape or Enter goes back.
		if (showScores) {
			if (event.key === 'Escape' || event.key === 'Enter') {
				event.preventDefault();
				showScores = false;
			}
			return;
		}

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
			// Escape goes back to the home page; Enter starts a game from it.
			if (event.key === 'Escape' && screen !== 'home') {
				screen = 'home';
			} else if (event.key === 'Enter' && screen === 'home') {
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
		const reserved = 44 + ((started ? tipsThisGame : showTips) ? 44 : 0) + 24;
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
			showTips = localStorage.getItem(SHOW_TIPS_KEY) === 'true';
		} catch {
			// Storage unavailable: keep the default (tips off).
		}
		// Restore the player's initials, if this browser remembers them.
		try {
			initials = localStorage.getItem(INITIALS_KEY) ?? '';
		} catch {
			// Storage unavailable: start with empty initials.
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

{#snippet tipCard(
	card: Tip,
	buttonLabel: string,
	onContinue: () => void,
	onBack: (() => void) | null
)}
	<div class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900 p-3">
		<div
			role="dialog"
			aria-labelledby="tip-title"
			class="max-h-full overflow-y-auto rounded-lg border-2 border-gold bg-slate-950 p-4 text-adenine"
		>
			<p class="text-xs font-bold tracking-wide uppercase opacity-70">
				Tip {TIPS.findIndex((t) => t.level === card.level) + 1} of {TIPS.length}
			</p>
			<h2 id="tip-title" class="text-lg font-black tracking-wide text-gold uppercase">
				{card.title}
			</h2>
			<p class="mt-1 text-sm">{card.text}</p>
			{#if card.codons}
				<p class="mt-2 flex flex-wrap gap-2">
					{#each card.codons as { codon, kind } (codon)}
						{@render chips(codon, kind)}
					{/each}
				</p>
			{/if}
			<div class="mt-3 flex flex-col gap-2">
				<button
					type="button"
					class="min-h-11 rounded bg-gold px-4 font-semibold tracking-wide text-slate-900 uppercase"
					onclick={onContinue}
				>
					{buttonLabel}
				</button>
				{#if onBack}
					{@render menuButton('Back', onBack)}
				{/if}
			</div>
			{#if !touch}
				<p class="mt-2 text-xs opacity-70">or press Enter</p>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet menuButton(label: string, onclick: () => void)}
	<button
		type="button"
		class="min-h-11 w-full rounded border-2 border-gold px-4 font-semibold tracking-wide text-gold uppercase hover:bg-gold/10"
		{onclick}
	>
		{label}
	</button>
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
				? 'bg-adenine'
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
	class="flex min-h-dvh flex-wrap items-start justify-center gap-6 pt-1 text-adenine select-none"
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
			<span class="text-lg font-black tracking-tight text-gold">{APP.name}</span>
			<span class="flex h-8 flex-1 items-center justify-center">
				{#if started && !paused && !view.over}
					{@render pieceGrid(view.next, 7)}
				{/if}
			</span>
			<span class="text-right leading-tight">
				<span class="block font-mono font-bold"
					><span class="font-sans text-[10px] uppercase opacity-70">Score</span>
					{view.score.score}</span
				>
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
		{#if tipsThisGame && started}
			<div
				class="flex h-11 flex-col items-center justify-center gap-1 text-center text-xs font-bold tracking-wide whitespace-nowrap uppercase"
				style:width="{barWidth}px"
			>
				{#if started && !view.over}
					{#if chainOpen}
						<p class="text-green-400">
							Chain ×2{bankable !== null ? ` · stop now: +${formatNumber(bankable)}` : ''}
						</p>
						<p class="flex items-center gap-1.5">
							{@render chips('UAA', 'stop')}
							{@render chips('UAG', 'stop')}
							{@render chips('UGA', 'stop')}
						</p>
					{:else if startReady}
						<p class="text-green-400">Start codon ready!</p>
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
					{@render tipCard(
						card,
						howTo + 1 < TIPS.length ? 'Next' : 'Done',
						nextHowTo,
						() => (howTo = null)
					)}
				{:else}
					<div class="absolute inset-0 overflow-y-auto bg-slate-900/90">
						<div class="flex min-h-full flex-col items-center justify-center gap-3 p-4 text-center">
							{#if !mounted}
								<p>Loading…</p>
							{:else if screen === 'instructions'}
								<h2 class="text-lg font-black tracking-wide text-gold uppercase">Instructions</h2>
								<p class="text-sm">
									Clear rows to score. Form start and stop codons to build chains of amino acids,
									for bonus points.
								</p>
								<dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-left text-sm">
									{#if touch}
										<dt class="font-bold">Drag sideways</dt>
										<dd>Move</dd>
										<dt class="font-bold">Drag down</dt>
										<dd>Move down</dd>
										<dt class="font-bold">Flick down</dt>
										<dd>Drop</dd>
										<dt class="font-bold">Tap</dt>
										<dd>Turn</dd>
										<dt class="font-bold">Swipe up</dt>
										<dd>Turn back</dd>
										<dt class="font-bold">Pause button</dt>
										<dd>Pause</dd>
									{:else}
										<dt class="font-bold">← →</dt>
										<dd>Move</dd>
										<dt class="font-bold">↓</dt>
										<dd>Move down</dd>
										<dt class="font-bold">Space</dt>
										<dd>Drop</dd>
										<dt class="font-bold">↑ or X</dt>
										<dd>Turn</dd>
										<dt class="font-bold">Z</dt>
										<dd>Turn back</dd>
										<dt class="font-bold">P or click</dt>
										<dd>Pause</dd>
									{/if}
								</dl>
								<div class="flex w-full max-w-56 flex-col gap-2">
									{@render menuButton('Game tips', () => (howTo = 0))}
									{@render menuButton('Main menu', () => (screen = 'home'))}
								</div>
							{:else if screen === 'settings'}
								<h2 class="text-lg font-black tracking-wide text-gold uppercase">Settings</h2>
								{@render tipsSwitch()}
								<div class="flex w-full max-w-56 flex-col gap-2">
									{@render menuButton('Main menu', () => (screen = 'home'))}
								</div>
							{:else}
								<p class="text-3xl font-black tracking-tight text-gold">{APP.name}</p>
								<p class="text-xs opacity-80">
									An educational game with falling tetrominoes and amino acids
								</p>
								<div class="flex w-full max-w-56 flex-col gap-2">
									<button
										type="button"
										class="min-h-12 w-full rounded bg-gold px-4 text-lg font-black tracking-wide text-slate-900 uppercase"
										onclick={start}
									>
										Start game
									</button>
									{@render menuButton('Instructions', () => (screen = 'instructions'))}
									{@render menuButton('High scores', () => (showScores = true))}
									{@render menuButton('Settings', () => (screen = 'settings'))}
								</div>
								{#if !touch}
									<p class="text-xs opacity-70">Press Enter to start</p>
								{/if}
								<p class="text-xs opacity-80">
									<a href={APP.sourceUrl} target="_blank" rel="noopener noreferrer">
										Source code (AGPL-3.0)<span class="sr-only"> (opens in a new tab)</span>
									</a>
									· Version {version}
								</p>
							{/if}
						</div>
					</div>
				{/if}
			{:else if tip}
				{@render tipCard(tip, 'Continue', () => (tip = null), null)}
			{:else if view.over}
				<div class="absolute inset-0 overflow-y-auto bg-slate-900">
					<div class="flex min-h-full flex-col items-center justify-center gap-2 p-3 text-center">
						{#if showStats}
							<h2 class="text-lg font-black tracking-wide text-gold uppercase">Stats</h2>

							<dl class="grid w-full grid-cols-3 gap-1 text-xs">
								<div>
									<dt class="opacity-70">Time</dt>
									<dd class="font-mono text-base font-bold">{formatTime(gameTime)}</dd>
								</div>
								<div>
									<dt class="opacity-70">Pieces</dt>
									<dd class="font-mono text-base font-bold">{piecesPlaced}</dd>
								</div>
								<div>
									<dt class="opacity-70">Best clear</dt>
									<dd class="font-mono text-base font-bold">
										{bestClear} row{bestClear === 1 ? '' : 's'}
									</dd>
								</div>
							</dl>

							<section class="w-full">
								<h3 class="text-xs font-bold tracking-wide uppercase opacity-70">
									Amino acids collected: {collected.length} of {ALL_AMINO_ACIDS.length}
								</h3>
								<ul class="mt-1 grid grid-cols-5 gap-1">
									{#each ALL_AMINO_ACIDS as aminoAcid (aminoAcid)}
										{@const made = collected.includes(aminoAcid)}
										<li
											class="rounded px-1 py-0.5 font-mono text-xs"
											class:bg-adenine={made}
											class:text-slate-900={made}
											class:opacity-30={!made}
										>
											<span aria-hidden="true">{AMINO_ACIDS[aminoAcid].short}</span>
											<span class="sr-only">
												{AMINO_ACIDS[aminoAcid].name}: {made ? 'collected' : 'not collected'}
											</span>
										</li>
									{/each}
								</ul>
							</section>

							{#if view.stats.longestChain >= 2}
								<section class="w-full">
									<h3 class="text-xs font-bold tracking-wide uppercase opacity-70">
										Your longest chain
									</h3>
									<p class="mt-1 font-mono text-xs break-words">
										{longestShown.join('–')}{#if longestMore > 0}
											… +{longestMore} more{/if}
									</p>
									<p class="mt-1 text-xs">
										{view.stats.longestChain} amino acids: {describeLength(
											view.stats.longestChain
										)}.
									</p>
								</section>
							{:else if redundancyFact}
								<p class="text-xs">
									{AMINO_ACIDS[redundancyFact.aminoAcid].name} came from {redundancyFact.codons
										.length} different codons: {redundancyFact.codons.join(', ')}. Many amino acids
									have more than one codon.
								</p>
							{:else if collected.length === 0}
								<p class="text-xs">
									No amino acids this time. Form AUG anywhere in a row, then clear it, to start a
									chain.
								</p>
							{/if}

							<div class="flex w-full max-w-56 flex-col gap-2">
								{@render menuButton('Back', () => (showStats = false))}
							</div>
						{:else}
							<p class="text-sm font-black tracking-widest text-gold uppercase">Game over</p>
							<p class="font-mono text-2xl font-black text-gold">
								<span class="font-sans text-sm uppercase">Score</span>
								{view.score.score}
							</p>
							{#if finalBonus > 0}
								<p class="text-xs opacity-80">
									Includes +{formatNumber(finalBonus)} for an unfinished chain
								</p>
							{/if}

							<dl class="grid w-full grid-cols-4 gap-1 text-xs">
								<div>
									<dt class="opacity-70">Level</dt>
									<dd class="font-mono text-base font-bold">{view.score.level}</dd>
								</div>
								<div>
									<dt class="opacity-70">Rows</dt>
									<dd class="font-mono text-base font-bold">{view.score.rows}</dd>
								</div>
								<div>
									<dt class="opacity-70">Chains</dt>
									<dd class="font-mono text-base font-bold">{view.stats.chains}</dd>
								</div>
								<div>
									<dt class="opacity-70">Longest</dt>
									<dd class="font-mono text-base font-bold">{view.stats.longestChain}</dd>
								</div>
							</dl>

							{#if view.score.score > 0 && savedRank === null}
								<form class="flex w-full flex-col items-center gap-2" onsubmit={saveScore}>
									<label
										for="initials"
										class="text-xs font-bold tracking-wide uppercase opacity-70"
									>
										Your initials
									</label>
									<div class="flex items-center gap-2">
										<input
											id="initials"
											bind:value={initials}
											maxlength="3"
											autocomplete="off"
											autocapitalize="characters"
											spellcheck="false"
											class="w-24 rounded bg-slate-950 px-2 py-2 text-center font-mono text-xl font-bold tracking-[0.3em] text-gold uppercase ring-2 ring-gold"
										/>
										<button
											type="submit"
											class="min-h-11 rounded bg-adenine px-4 font-semibold tracking-wide text-slate-900 uppercase disabled:opacity-50"
											disabled={saving}
										>
											{saving ? 'Saving…' : 'Save'}
										</button>
									</div>
									{#if saveError}
										<p class="text-xs text-uracil" role="alert">{saveError}</p>
									{/if}
									<!-- Turnstile's invisible check runs here; nothing is shown. -->
									<div bind:this={turnstileBox}></div>
								</form>
							{/if}

							<div class="flex w-full max-w-56 flex-col gap-2">
								<button
									type="button"
									class="min-h-11 w-full rounded bg-gold px-4 font-semibold tracking-wide text-slate-900 uppercase"
									onclick={start}
								>
									Play again
								</button>
								{@render menuButton('Stats', () => (showStats = true))}
								{@render menuButton('High scores', () => (showScores = true))}
								{@render menuButton('Main menu', goHome)}
							</div>
						{/if}
					</div>
				</div>
			{:else if paused}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-4 text-center"
				>
					{#if confirmQuit}
						<p class="text-lg font-bold text-gold">Quit this game?</p>
						<p class="text-sm">Your score won't be saved.</p>
						<div class="flex w-full max-w-56 flex-col gap-2">
							<button
								type="button"
								class="min-h-11 rounded bg-gold px-6 font-semibold tracking-wide text-slate-900 uppercase"
								onclick={() => (confirmQuit = false)}
							>
								Keep playing
							</button>
							{@render menuButton('Quit', goHome)}
						</div>
					{:else}
						<p class="text-xl font-bold text-gold">Paused</p>
						<div class="flex w-full max-w-56 flex-col gap-2">
							<button
								type="button"
								class="min-h-11 rounded bg-gold px-6 font-semibold tracking-wide text-slate-900 uppercase"
								onclick={togglePause}
							>
								Resume
							</button>
							{@render menuButton('Quit game', () => (confirmQuit = true))}
						</div>
					{/if}
				</div>
			{/if}

			{#if showScores}
				<HighScores
					highlightId={view.over ? savedId : null}
					startLimit={view.over && (savedRank ?? 0) > 10 ? 100 : 10}
					closeLabel={started ? 'Back' : 'Main menu'}
					onClose={() => (showScores = false)}
				/>
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
