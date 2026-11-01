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
	import { version } from '$app/env';
	import HighScores, { type NewScore } from '#lib/components/HighScores.svelte';
	import { cuesFor } from '#lib/audio/cues.js';
	import {
		play,
		setMusicVolume,
		setSoundEnabled,
		setSoundVolume,
		unlockAudio
	} from '#lib/audio/sound.js';
	import { playMusic, restartMusic, setMusicEnabled, stopMusic } from '#lib/audio/music.js';
	import CodeRain from '#lib/components/CodeRain.svelte';
	import { resolve } from '$app/paths';

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

	/** Where the sound on/off choice is remembered in this browser. */
	const SOUND_KEY = 'sound';
	const MUSIC_KEY = 'music';
	const SOUND_VOLUME_KEY = 'soundVolume';
	const MUSIC_VOLUME_KEY = 'musicVolume';

	/** The wordmark's letters, coloured like the logo: C blue, O and A green, D gold, N red. */
	const WORDMARK_COLOURS: Record<string, string> = {
		c: 'text-cytosine',
		o: 'text-adenine',
		d: 'text-guanine',
		n: 'text-uracil',
		a: 'text-adenine'
	};
	const WORDMARK = [...APP.name];

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
	/** True if the player ended the game from the pause screen. */
	let quitted = $state(false);
	/** The game is over: either the board filled up, or the player ended it. */
	const over = $derived(view.over || quitted);
	/** True once the page's code is running, so buttons work when they appear. */
	let mounted = $state(false);
	let started = $state(false);
	let paused = $state(false);
	/** Whether tip cards and the goal bar appear during the game. */
	let showTips = $state(true);
	/** Whether sound effects play. On by default. */
	let soundOn = $state(true);
	/** Music on or off, and the two volumes (0 to 100). */
	let musicOn = $state(true);
	let soundVolume = $state(80);
	let musicVolume = $state(50);
	/** Whether tips were on at any point in this game: recorded with a saved score. */
	let tipsUsed = $state(false);
	/** True once the player has pressed something: browsers only allow sound after that. */
	let audioReady = $state(false);
	/** Waits a moment after GAME OVER before showing the high-score table. */
	let scoresTimer: ReturnType<typeof setTimeout> | undefined;
	/** The "LEVEL n" pop-up on the board, and its timer. */
	let levelBanner = $state<number | null>(null);
	let bannerTimer: ReturnType<typeof setTimeout> | undefined;
	/** True during the short GAME OVER pause before the high-score table. */
	let gameOverPause = $state(false);
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
	let savedRank = $state<number | null>(null);
	/** The database ID of the just-saved score, for highlighting it in the table. */
	let savedId = $state<number | null>(null);
	/** Gameplay stats for the Stats page: tetrominoes placed, best clear, game length. */
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
	/** When the current game started, and how long it lasted (for the server's speed check). */
	let startedAt = 0;
	let durationMs = 0;

	const boardPixelWidth = $derived(BOARD_WIDTH * cell);
	const boardPixelHeight = $derived(BOARD_HEIGHT * cell);
	/** On phones, the bars may be wider than the board, using the side space. */
	const barWidth = $derived(
		touch ? Math.max(boardPixelWidth, Math.min(viewportWidth - 16, 420)) : boardPixelWidth
	);

	const playing = $derived(started && !paused && !tip && !over);
	const chainOpen = $derived(started && !over && view.translation.chain !== null);

	/** What a stop codon would bank right now, if the chain is long enough. */
	const bankable = $derived(
		view.translation.chain && view.translation.chain.length >= 2
			? chainBonus(view.translation.chain.length, view.score.level)
			: null
	);

	/** An AUG is placed on the board, but its row hasn't been cleared yet. */
	const startReady = $derived(
		started &&
			!over &&
			!chainOpen &&
			findMarks(view.board, view.translation).some((mark) => mark.kind === 'start')
	);

	/** Where the falling piece could form a START (or, with a chain open, a STOP). */
	const opportunities = $derived(
		started && !over && view.active
			? findOpportunities(view.board, view.active.piece, view.translation)
			: { kind: 'start' as const, cells: [], squares: [] }
	);

	/** The game-over summary: amino acids made, and one fact about codon redundancy. */
	const aminoSummary = $derived(over ? summariseAminoAcids(view.stats) : []);
	const redundancyFact = $derived(redundancyHighlight(aminoSummary));
	/** A finished game not yet saved: handed to the high-score table, where the player adds initials. */
	const newScore = $derived<NewScore | null>(
		over && view.score.score > 0 && savedId === null
			? {
					score: view.score.score,
					level: view.score.level,
					rows: view.score.rows,
					chains: view.stats.chains,
					longestChain: view.stats.longestChain,
					durationMs: gameTime,
					generatorVersion: view.generatorVersion,
					tips: tipsUsed
				}
			: null
	);
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

	/** A button press: allows sound from now on, and plays the "select" blip. */
	function click() {
		unlockAudio();
		audioReady = true;
		play('select');
	}

	/** Start a new game with a fresh seed, opening with the first tip if tips are on. */
	function start() {
		unlockAudio();
		audioReady = true;
		play('select');
		clearTimeout(scoresTimer);
		clearTimeout(bannerTimer);
		levelBanner = null;
		gameOverPause = false;
		game = createGame({ seed: randomSeed() });
		view = game.state;
		paused = false;
		finalBonus = 0;
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
		tipsUsed = tipsThisGame;
		restartMusic();
		quitted = false;
	}

	function act(action: Action): ActionResult | null {
		if (!playing) return null;
		const before = game.state.active;
		const levelBefore = game.state.score.level;
		const result = game.act(action);
		view = game.state;
		const after = game.state.active;

		if (result.locked) piecesPlaced++;
		if (result.clear) bestClear = Math.max(bestClear, result.clear.rows.length);
		if (result.gameOver) finishGame(result.gameOver.unfinishedPoints);

		const levelledUp = !over && view.score.level > levelBefore;
		if (levelledUp) {
			levelBanner = view.score.level;
			clearTimeout(bannerTimer);
			bannerTimer = setTimeout(() => (levelBanner = null), 1500);
		}
		for (const cue of cuesFor(action, result, {
			moved: !!before && !!after && (before.x !== after.x || before.y !== after.y),
			turned: !!before && !!after && before.piece !== after.piece && !result.locked,
			levelledUp
		})) {
			play(cue.sound, cue.rows);
		}

		if (tipsThisGame && levelledUp) tip = tipForLevel(view.score.level) ?? null;
		return result;
	}

	/** After any game over: record the length, then GAME OVER for a moment, then the high-score table. */
	function finishGame(bonus: number) {
		finalBonus = bonus;
		durationMs = Math.round(performance.now() - startedAt);
		gameTime = durationMs;
		if (view.score.score > 0) {
			gameOverPause = true;
			scoresTimer = setTimeout(() => {
				gameOverPause = false;
				if (started && over) showScores = true;
			}, 2000);
		}
	}

	/** End the game from the pause screen: just like a game over, but no unfinished-chain bonus. */
	function endGame() {
		quitted = true;
		paused = false;
		confirmQuit = false;
		play('over');
		finishGame(0);
	}

	/** From the game-over screen: go to the Instructions page. */
	function showInstructions() {
		goHome();
		screen = 'instructions';
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

	/** Remember a setting in this browser. */
	function remember(key: string, value: string) {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Not remembered; that's fine.
		}
	}

	/** Turn sound effects on or off, and remember the choice. Switching on at volume 0 sets 50%. */
	function setSound(value: boolean) {
		soundOn = value;
		setSoundEnabled(value);
		if (value) {
			unlockAudio();
			audioReady = true;
			if (soundVolume === 0) setSoundLevel(50);
		}
		remember(SOUND_KEY, String(value));
	}

	/** Turn music on or off, and remember the choice. Switching on at volume 0 sets 50%. */
	function setMusic(value: boolean) {
		musicOn = value;
		setMusicEnabled(value);
		if (value) {
			unlockAudio();
			audioReady = true;
			if (musicVolume === 0) setMusicLevel(50);
		}
		remember(MUSIC_KEY, String(value));
	}

	/** Sound effects volume (0 to 100). Sliding to 0 switches sound off. */
	function setSoundLevel(value: number) {
		soundVolume = value;
		setSoundVolume(value / 100);
		remember(SOUND_VOLUME_KEY, String(value));
		if (value === 0 && soundOn) setSound(false);
	}

	/** Music volume (0 to 100). Sliding to 0 switches music off. */
	function setMusicLevel(value: number) {
		musicVolume = value;
		setMusicVolume(value / 100);
		remember(MUSIC_VOLUME_KEY, String(value));
		if (value === 0 && musicOn) setMusic(false);
	}

	/** A stored number from 0 to 100, or the default if there isn't a valid one. */
	function storedLevel(key: string, fallback: number): number {
		try {
			const value = Number(localStorage.getItem(key) ?? fallback);
			return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
		} catch {
			return fallback;
		}
	}

	/** Step through the "How to play" cards, closing after the last one. */
	function nextHowTo() {
		if (howTo === null) return;
		howTo = howTo + 1 < TIPS.length ? howTo + 1 : null;
	}

	function togglePause() {
		if (!started || over || tip) return;
		paused = !paused;
		confirmQuit = false;
		// A tips change made on the pause screen applies on resuming, so nothing moves under the pointer.
		if (!paused && tipsThisGame !== showTips) {
			tipsThisGame = showTips;
			if (tipsThisGame) tipsUsed = true;
			fitBoard();
		}
	}

	/** Leave the current game (or the game-over screen) and return to the home screen. */
	function goHome() {
		clearTimeout(scoresTimer);
		clearTimeout(bannerTimer);
		levelBanner = null;
		gameOverPause = false;
		started = false;
		paused = false;
		tip = null;
		howTo = null;
		confirmQuit = false;
		showScores = false;
		showStats = false;
		screen = 'home';
		quitted = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (!mounted) return;

		// Any key press may restart sound after an interruption.
		if (audioReady) unlockAudio();

		// Typing in a box (such as initials) goes to the box, not the game.
		if (event.target instanceof HTMLInputElement) return;

		// The high-score table: Escape goes back.
		if (showScores) {
			if (event.key === 'Escape') {
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
		// Any tap may restart sound after an interruption.
		if (audioReady) unlockAudio();

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
		if (document.visibilityState === 'hidden' && started && !over) paused = true;
		gesture = null;
	}

	/** Fit the board to the screen, leaving room for the top bar (and the goal bar, if tips are on). */
	function fitBoard() {
		viewportWidth = window.innerWidth;
		// The page's own top and bottom spacing (status bar, home indicator) isn't board space either.
		const style = getComputedStyle(document.body);
		const spacing = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
		const reserved = 44 + ((started ? tipsThisGame : showTips) ? 44 : 0) + 24 + spacing;
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

	// Music: the calm version on the menu screens, the full version while playing (faster with
	// each level), and silence when paused or after game over. Only after the first button press.
	$effect(() => {
		if (!musicOn || !audioReady) stopMusic();
		else if (playing) playMusic(view.score.level, 'game');
		else if (!started) playMusic(1, 'menu');
		else stopMusic();
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

		// Restore the sound choice (on unless turned off).
		try {
			soundOn = localStorage.getItem(SOUND_KEY) !== 'false';
		} catch {
			// Storage unavailable: keep the default (sound on).
		}
		setSoundEnabled(soundOn);

		// Restore music and volumes.
		try {
			musicOn = localStorage.getItem(MUSIC_KEY) !== 'false';
		} catch {
			// Storage unavailable: keep the default (music on).
		}
		setMusicEnabled(musicOn);
		soundVolume = storedLevel(SOUND_VOLUME_KEY, 80);
		musicVolume = storedLevel(MUSIC_VOLUME_KEY, 50);
		setSoundVolume(soundVolume / 100);
		setMusicVolume(musicVolume / 100);

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

		// Turning the phone resizes the board suddenly, so pause (not on every resize:
		// Safari's toolbar sliding in and out also resizes the page).
		const portrait = window.matchMedia('(orientation: portrait)');
		function onTurn() {
			if (playing) paused = true;
		}
		portrait.addEventListener('change', onTurn);

		return () => {
			cancelAnimationFrame(frame);
			playArea?.removeEventListener('touchstart', stopDefaultTouch);
			stopMusic();
			portrait.removeEventListener('change', onTurn);
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
	onBack: (() => void) | null,
	level: number | null
)}
	<div
		class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-900 p-3"
	>
		{#if level === null}
			<div class="pointer-events-none absolute inset-x-0 top-0">
				<CodeRain height={64} />
			</div>
		{/if}
		{#if level !== null}
			<p
				class="relative font-arcade text-2xl font-black tracking-widest text-adenine uppercase"
				role="status"
			>
				Level {level}
			</p>
		{/if}
		<div
			role="dialog"
			aria-labelledby="tip-title"
			class="relative max-h-full overflow-y-auto rounded-lg border-2 border-gold bg-slate-950 p-4 text-adenine"
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
					onclick={() => {
						click();
						onContinue();
					}}
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
		onclick={() => {
			click();
			onclick();
		}}
	>
		{label}
	</button>
{/snippet}

{#snippet toggle(label: string, on: boolean, onToggle: () => void)}
	<button
		type="button"
		role="switch"
		aria-checked={on}
		class="flex min-h-11 items-center gap-3 text-sm"
		onclick={() => {
			click();
			onToggle();
		}}
	>
		<span
			class="relative h-7 w-12 shrink-0 rounded-full transition-colors {on
				? 'bg-adenine'
				: 'bg-slate-500'}"
		>
			<span
				class="absolute top-1 h-5 w-5 rounded-full bg-white transition-all {on
					? 'left-6'
					: 'left-1'}"
			></span>
		</span>
		{label}
	</button>
{/snippet}

{#snippet volumeIcon(level: number, on: boolean)}
	<svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" aria-hidden="true">
		<path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" />
		<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			{#if !on || level === 0}
				<path d="M16 9l5 6M21 9l-5 6" />
			{:else}
				<path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
				{#if level > 33}
					<path d="M17.5 7a7 7 0 0 1 0 10" />
				{/if}
				{#if level > 66}
					<path d="M20 4.5a10.5 10.5 0 0 1 0 15" />
				{/if}
			{/if}
		</g>
	</svg>
{/snippet}

{#snippet audioControl(
	label: string,
	on: boolean,
	onToggle: () => void,
	level: number,
	onLevel: (value: number) => void
)}
	<div class="flex w-full items-center gap-3">
		{@render toggle(label, on, onToggle)}
		<span class="ml-auto" class:opacity-40={!on}>{@render volumeIcon(level, on)}</span>
		<input
			type="range"
			min="0"
			max="100"
			step="5"
			value={level}
			disabled={!on}
			aria-label="{label} volume"
			class="w-24 accent-adenine disabled:opacity-40"
			oninput={(event) => onLevel(Number(event.currentTarget.value))}
		/>
	</div>
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

{#snippet wordmark()}
	<span aria-hidden="true"
		>{#each WORDMARK as letter, index (index)}<span class={WORDMARK_COLOURS[letter.toLowerCase()]}
				>{letter}</span
			>{/each}</span
	>
	<span class="sr-only">{APP.name}</span>
{/snippet}

<!-- The whole play area takes gestures, so a swipe beside the board still controls the piece. -->
<div
	bind:this={playArea}
	class="play-area flex flex-wrap items-start justify-center gap-6 pt-1 text-adenine select-none"
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
		<div class="flex h-11 items-center gap-2 sm:gap-3" style:width="{barWidth}px">
			<span class="font-arcade text-xs tracking-wide sm:text-base">{@render wordmark()}</span>
			<span class="flex h-8 flex-1 items-center justify-center">
				{#if started && !paused && !over}
					{@render pieceGrid(view.next, 7)}
				{/if}
			</span>
			<span class="text-right leading-tight whitespace-nowrap">
				<span class="block font-mono text-sm font-bold sm:text-base"
					><span class:sr-only={view.score.score >= 10_000}>Score&nbsp;</span>{view.score
						.score}</span
				>
				<span class="block text-[10px] uppercase">{view.stats.chains} chains</span>
			</span>
			<span class="text-right leading-tight whitespace-nowrap">
				<span class="block font-mono text-sm font-bold sm:text-base">Lv {view.score.level}</span>
				<span class="block text-[10px] uppercase">{view.score.rows} rows</span>
			</span>
			<button
				type="button"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-uracil text-slate-900 disabled:opacity-30"
				onclick={() => {
					click();
					togglePause();
				}}
				disabled={!started || over || !!tip}
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
		</div>

		<!-- Goal bar: what to aim for right now. Shown with tips; fixed height, so the board never jumps. -->
		{#if tipsThisGame && started}
			<div
				class="flex h-11 flex-col items-center justify-center gap-1 text-center text-xs font-bold tracking-wide whitespace-nowrap uppercase"
				style:width="{barWidth}px"
			>
				{#if started && !over}
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
			{#if levelBanner !== null}
				<div class="pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center">
					{#key levelBanner}
						<p
							class="level-pop inline-block rounded bg-slate-950/80 px-4 py-2 font-arcade text-2xl text-adenine uppercase"
							role="status"
						>
							Level {levelBanner}
						</p>
					{/key}
				</div>
			{/if}

			{#if !started}
				{@const card = howTo === null ? undefined : TIPS[howTo]}
				{#if card && howTo !== null}
					{@render tipCard(
						card,
						howTo + 1 < TIPS.length ? 'Next' : 'Done',
						nextHowTo,
						() => (howTo = null),
						null
					)}
				{:else}
					<div class="absolute inset-0 overflow-y-auto bg-slate-900">
						<!-- Genetic-code rain across the top of the menu screens. -->
						<div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-16">
							<CodeRain height={64} />
						</div>
						<div
							class="relative z-10 flex min-h-full flex-col items-center justify-center gap-3 p-4 pt-16 text-center"
						>
							{#if !mounted}
								<p>Loading…</p>
							{:else if screen === 'instructions'}
								<h2 class="font-arcade text-base text-gold uppercase">Instructions</h2>
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
								<h2 class="font-arcade text-base text-gold uppercase">Settings</h2>
								<div class="flex w-full max-w-64 flex-col items-start">
									{@render audioControl(
										'Sound',
										soundOn,
										() => setSound(!soundOn),
										soundVolume,
										setSoundLevel
									)}
									{@render audioControl(
										'Music',
										musicOn,
										() => setMusic(!musicOn),
										musicVolume,
										setMusicLevel
									)}
									{@render toggle('Show tips in game', showTips, () => setShowTips(!showTips))}
								</div>
								<div class="flex w-full max-w-56 flex-col gap-2">
									{@render menuButton('Main menu', () => (screen = 'home'))}
								</div>
							{:else}
								<button
									type="button"
									class="absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gold text-slate-900"
									aria-label="Sound"
									aria-pressed={soundOn}
									onclick={() => setSound(!soundOn)}
								>
									<svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
										<path d="M4 9v6h4l5 4V5L8 9H4z" />
										{#if soundOn}
											<path
												d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
											/>
										{:else}
											<path
												d="M16 9l5 6M21 9l-5 6"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
											/>
										{/if}
									</svg>
								</button>
								<button
									type="button"
									class="absolute top-2 right-13 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gold text-slate-900"
									aria-label="Music"
									aria-pressed={musicOn}
									onclick={() => setMusic(!musicOn)}
								>
									<svg
										viewBox="0 0 24 24"
										class="h-5 w-5"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										aria-hidden="true"
									>
										<path d="M9 17V5l10-2v12" />
										<circle cx="6.5" cy="17" r="2.5" fill="currentColor" />
										<circle cx="16.5" cy="15" r="2.5" fill="currentColor" />
										{#if !musicOn}
											<path d="M3 3l18 18" />
										{/if}
									</svg>
								</button>
								<p class="font-arcade text-3xl tracking-wide">
									{@render wordmark()}
								</p>
								<p class="text-xs">An educational game<br />with falling blocks and amino acids</p>
								<div class="my-3 flex w-full max-w-56 flex-col gap-2">
									<button
										type="button"
										class="relative min-h-12 w-full rounded bg-gold px-4 text-lg font-black tracking-wide text-slate-900 uppercase"
										aria-keyshortcuts="Enter"
										onclick={start}
									>
										Start game{#if !touch}<span
												aria-hidden="true"
												class="absolute top-1/2 right-4 -translate-y-1/2">↵</span
											>{/if}
									</button>
									{@render menuButton('Instructions', () => (screen = 'instructions'))}
									{@render menuButton('High scores', () => (showScores = true))}
									{@render menuButton('Settings', () => (screen = 'settings'))}
								</div>
								<p class="text-xs">
									<a href={resolve('/about')}>About & Privacy</a>
									·
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external link -->
									<a href={APP.sourceUrl} target="_blank" rel="noopener noreferrer">
										Source Code (AGPL-3.0)<span class="sr-only"> (opens in a new tab)</span>
									</a>
								</p>
								<p class="text-xs">
									© {APP.copyrightYear}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external link -->
									<a href={APP.authorUrl} target="_blank" rel="noopener noreferrer">
										{APP.author}<span class="sr-only"> (opens in a new tab)</span>
									</a>
									· Version {version}
								</p>
							{/if}
						</div>
					</div>
				{/if}
			{:else if tip}
				{@render tipCard(tip, 'Continue', () => (tip = null), null, view.score.level)}
			{:else if over && gameOverPause}
				<div class="absolute inset-0 flex items-center justify-center bg-slate-900">
					<h2 class="font-arcade text-2xl leading-normal text-uracil uppercase">Game over</h2>
				</div>
			{:else if over}
				<div class="absolute inset-0 overflow-y-auto bg-slate-900">
					<div class="flex min-h-full flex-col items-center justify-center gap-2 p-3 text-center">
						{#if showStats}
							<h2 class="mb-2 font-arcade text-base text-gold uppercase">Stats</h2>

							<dl class="grid w-full grid-cols-3 gap-1 text-xs">
								<div>
									<dt class="opacity-70">Time</dt>
									<dd class="font-mono text-base font-bold">{formatTime(gameTime)}</dd>
								</div>
								<div>
									<dt class="opacity-70">Blocks Placed</dt>
									<dd class="font-mono text-base font-bold">{piecesPlaced}</dd>
								</div>
								<div>
									<dt class="opacity-70">Best Clear</dt>
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
							{/if}

							<div class="mt-2 flex w-full max-w-56 flex-col gap-2">
								{@render menuButton('Back', () => (showStats = false))}
							</div>
						{:else}
							<h2 class="font-arcade text-2xl leading-normal text-uracil uppercase">Game over</h2>
							<p class="font-mono text-2xl font-black text-gold">Score {view.score.score}</p>
							{#if finalBonus > 0}
								<p class="text-xs opacity-80">
									Includes +{formatNumber(finalBonus)} for an unfinished chain
								</p>
							{/if}

							<dl class="my-3 grid w-full grid-cols-4 gap-1 text-xs">
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

							<div class="flex w-full max-w-56 flex-col gap-2">
								<button
									type="button"
									class="min-h-11 w-full rounded bg-gold px-4 font-semibold tracking-wide text-slate-900 uppercase"
									onclick={start}
								>
									Play again
								</button>
								{#if newScore}
									{@render menuButton('Save score', () => (showScores = true))}
								{/if}
								{@render menuButton('Stats', () => (showStats = true))}
								{@render menuButton('High scores', () => (showScores = true))}
								{#if view.stats.chains === 0}
									{@render menuButton('Instructions', showInstructions)}
								{/if}
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
						<p class="text-lg font-bold text-uracil">End this game?</p>
						<p class="text-sm">You'll see your score and stats.</p>
						<div class="flex w-full max-w-56 flex-col gap-2">
							<button
								type="button"
								class="min-h-11 rounded bg-gold px-6 font-semibold tracking-wide text-slate-900 uppercase"
								onclick={() => {
									click();
									confirmQuit = false;
								}}
							>
								Keep playing
							</button>
							{@render menuButton('Yes, end it', endGame)}
						</div>
					{:else}
						<h2 class="font-arcade text-2xl text-uracil uppercase">Paused</h2>
						<div class="my-3 flex w-full max-w-64 flex-col items-start">
							{@render audioControl(
								'Sound',
								soundOn,
								() => setSound(!soundOn),
								soundVolume,
								setSoundLevel
							)}
							{@render audioControl(
								'Music',
								musicOn,
								() => setMusic(!musicOn),
								musicVolume,
								setMusicLevel
							)}
							{@render toggle('Show tips', showTips, () => setShowTips(!showTips))}
						</div>
						<div class="flex w-full max-w-56 flex-col gap-2">
							<button
								type="button"
								class="min-h-11 rounded bg-gold px-6 font-semibold tracking-wide text-slate-900 uppercase"
								onclick={() => {
									click();
									togglePause();
								}}
							>
								Resume
							</button>
							{@render menuButton('End game', () => (confirmQuit = true))}
						</div>
					{/if}
				</div>
			{/if}

			{#if showScores}
				<HighScores
					newScore={over ? newScore : null}
					highlightId={over ? savedId : null}
					startLimit={over && (savedRank ?? 0) > 10 ? 100 : 10}
					closeLabel={started ? 'Back' : 'Main menu'}
					onSaved={(id, rank) => {
						savedId = id;
						savedRank = rank;
					}}
					onClose={() => (showScores = false)}
				/>
			{/if}
		</div>
	</div>
</div>
