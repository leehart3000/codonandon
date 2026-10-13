import type { AminoAcid, Base, Codon } from '../genetics/genetic-code';
import {
	clearFullRows,
	createBoard,
	drop,
	fits,
	lock,
	move,
	rotate,
	spawn,
	type ActivePiece,
	type Board
} from './board';
import { GENERATOR_VERSION, createPieceGenerator, type Piece } from './pieces';
import { createRandom } from './random';
import { initialScore, scoreClear, unfinishedChainPoints, type ScoreState } from './scoring';
import {
	initialTranslationState,
	readRows,
	type ReadEvent,
	type TranslationState
} from './translation';

/** Everything the player (or the automatic fall) can do. */
export type Action =
	'left' | 'right' | 'down' | 'drop' | 'rotate-clockwise' | 'rotate-anticlockwise' | 'tick';

export interface Stats {
	/** How many of each amino acid were made. */
	aminoAcids: Partial<Record<AminoAcid, number>>;
	/** How many times each codon was used to make an amino acid. */
	codons: Partial<Record<Codon, number>>;
	/** Completed chains. */
	chains: number;
	/** Amino acids in the longest completed chain. */
	longestChain: number;
}

export interface GameState {
	seed: number;
	generatorVersion: number;
	board: Board;
	/** The piece in play, or null once the game is over. */
	active: ActivePiece | null;
	next: Piece;
	translation: TranslationState;
	score: ScoreState;
	stats: Stats;
	over: boolean;
}

/** What happened when rows were cleared. */
export interface ClearReport {
	/** The cleared rows, bottom row first. */
	rows: Base[][];
	events: ReadEvent[];
	rowPoints: number;
	chainPoints: number;
	/** Row points were multiplied by this, because a chain was open. */
	multiplier: number;
}

/** What an action caused, for the display, animations and sounds to react to. */
export interface ActionResult {
	/** The piece landed and was fixed into the board. */
	locked: boolean;
	/** Rows cleared by this action, if any. */
	clear: ClearReport | null;
	/** Set if the game ended, with the points added for an unfinished chain. */
	gameOver: { unfinishedPoints: number } | null;
}

export interface GameOptions {
	seed: number;
	/** For tests: start from this board instead of an empty one. */
	board?: Board;
	/** For tests: deal these pieces instead of random ones. */
	nextPiece?: () => Piece;
}

/** Milliseconds between automatic one-row falls: faster at higher levels. */
export function fallInterval(level: number): number {
	return Math.max(100, 1000 - (level - 1) * 75);
}

const NOTHING: ActionResult = { locked: false, clear: null, gameOver: null };

export function createGame(options: GameOptions) {
	const nextPiece = options.nextPiece ?? createPieceGenerator(createRandom(options.seed));

	let state: GameState = {
		seed: options.seed,
		generatorVersion: GENERATOR_VERSION,
		board: options.board ?? createBoard(),
		active: spawn(nextPiece()),
		next: nextPiece(),
		translation: initialTranslationState,
		score: initialScore,
		stats: { aminoAcids: {}, codons: {}, chains: 0, longestChain: 0 },
		over: false
	};

	function act(action: Action): ActionResult {
		const active = state.active;
		if (state.over || !active) return NOTHING;

		switch (action) {
			case 'left':
				return moveTo(move(state.board, active, -1, 0));
			case 'right':
				return moveTo(move(state.board, active, 1, 0));
			case 'rotate-clockwise':
				return moveTo(rotate(state.board, active, 'clockwise'));
			case 'rotate-anticlockwise':
				return moveTo(rotate(state.board, active, 'anticlockwise'));
			case 'down':
			case 'tick': {
				const lower = move(state.board, active, 0, 1);
				return lower ? moveTo(lower) : land(active);
			}
			case 'drop':
				return land(drop(state.board, active));
		}
	}

	/** Use the new position if there is one; otherwise nothing changes. */
	function moveTo(moved: ActivePiece | null): ActionResult {
		if (moved) state = { ...state, active: moved };
		return NOTHING;
	}

	/** Lock the piece, clear and read full rows, score them, then bring in the next piece. */
	function land(active: ActivePiece): ActionResult {
		const { board, cleared } = clearFullRows(lock(state.board, active));
		let { translation, score, stats } = state;
		let clear: ClearReport | null = null;

		if (cleared.length > 0) {
			const chainOpen = translation.chain !== null;
			const read = readRows(translation, cleared);
			const scored = scoreClear(score, cleared.length, read.events, chainOpen);
			translation = read.state;
			score = scored.state;
			stats = updateStats(stats, read.events);
			clear = {
				rows: cleared,
				events: read.events,
				rowPoints: scored.rowPoints,
				chainPoints: scored.chainPoints,
				multiplier: scored.multiplier
			};
		}

		const spawned = spawn(state.next);
		if (!fits(board, spawned)) {
			const unfinishedPoints = unfinishedChainPoints(translation.chain);
			state = {
				...state,
				board,
				active: null,
				translation,
				stats,
				score: { ...score, score: score.score + unfinishedPoints },
				over: true
			};
			return { locked: true, clear, gameOver: { unfinishedPoints } };
		}

		state = { ...state, board, active: spawned, next: nextPiece(), translation, score, stats };
		return { locked: true, clear, gameOver: null };
	}

	return {
		get state() {
			return state;
		},
		act
	};
}

/** Add amino acids, codons and chains from read events to the stats. */
function updateStats(stats: Stats, events: readonly ReadEvent[]): Stats {
	const aminoAcids = { ...stats.aminoAcids };
	const codons = { ...stats.codons };
	let { chains, longestChain } = stats;

	for (const event of events) {
		if (event.type === 'start' || event.type === 'add') {
			const aminoAcid = event.type === 'start' ? 'M' : event.aminoAcid;
			aminoAcids[aminoAcid] = (aminoAcids[aminoAcid] ?? 0) + 1;
			codons[event.codon] = (codons[event.codon] ?? 0) + 1;
		} else if (event.type === 'complete') {
			chains += 1;
			longestChain = Math.max(longestChain, event.chain.length);
		}
	}

	return { aminoAcids, codons, chains, longestChain };
}
