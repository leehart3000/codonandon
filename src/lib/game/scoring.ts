import type { AminoAcid } from '../genetics/genetic-code';
import type { ReadEvent } from './translation';

/** All scoring numbers in one place, so they're easy to tune after playtesting. */
export const SCORING = {
	/** Points for clearing 0, 1, 2, 3 or 4 rows at once, before multiplying by the level. */
	rows: [0, 100, 300, 500, 800],
	/** A completed chain: a fixed bonus plus an amount per amino acid, times the level. */
	chainBase: 200,
	chainPerAminoAcid: 50,
	/** An unfinished chain at game over: per amino acid, not multiplied by the level. */
	unfinishedPerAminoAcid: 10,
	/** Rows to clear to go up a level. */
	rowsPerLevel: 10
} as const;

export interface ScoreState {
	score: number;
	rows: number;
	level: number;
}

export const initialScore: ScoreState = { score: 0, rows: 0, level: 1 };

/** The level after clearing this many rows in total. */
export function levelFor(rows: number): number {
	return 1 + Math.floor(rows / SCORING.rowsPerLevel);
}

/** The bonus for completing a chain of this many amino acids. */
export function chainBonus(length: number, level: number): number {
	return (SCORING.chainBase + SCORING.chainPerAminoAcid * length) * level;
}

/** Points for an unfinished chain when the game ends. */
export function unfinishedChainPoints(chain: readonly AminoAcid[] | null): number {
	return (chain?.length ?? 0) * SCORING.unfinishedPerAminoAcid;
}

/**
 * Score one clear: the rows cleared together, plus a bonus for each chain completed
 * while reading them. Points use the level before the clear.
 */
export function scoreClear(
	state: ScoreState,
	rowsCleared: number,
	events: readonly ReadEvent[]
): { state: ScoreState; rowPoints: number; chainPoints: number } {
	const rowPoints = (SCORING.rows[rowsCleared] ?? 0) * state.level;
	const chainPoints = events.reduce(
		(sum, event) =>
			event.type === 'complete' ? sum + chainBonus(event.chain.length, state.level) : sum,
		0
	);
	const rows = state.rows + rowsCleared;
	return {
		state: { score: state.score + rowPoints + chainPoints, rows, level: levelFor(rows) },
		rowPoints,
		chainPoints
	};
}
