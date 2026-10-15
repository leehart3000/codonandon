import { GENERATOR_VERSION } from '../game/pieces';
import { SCORING, levelFor } from '../game/scoring';

/** A high-score submission, after checking. */
export interface Submission {
	initials: string;
	score: number;
	level: number;
	rows: number;
	chains: number;
	longestChain: number;
	durationMs: number;
	generatorVersion: number;
	tips: boolean;
	offline: boolean;
}

export type Validation = { ok: true; submission: Submission } | { ok: false; error: string };

/** Fastest believable play: each row needs at least 3 pieces; this allows about 6–7 pieces a second. */
export const MIN_MS_PER_ROW = 450;

const fail = (error: string): Validation => ({ ok: false, error });
const isCount = (value: unknown): value is number =>
	Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100_000_000;

/**
 * A generous upper bound on the score a game with these rows, chains and level could earn:
 * every row at the best rate and doubled, every amino acid in a chain, all at the final level.
 */
export function maxPlausibleScore({
	rows,
	chains,
	level
}: Pick<Submission, 'rows' | 'chains' | 'level'>): number {
	const bestPerRow = (SCORING.rows[4] ?? 0) / 4;
	const rowPoints = rows * bestPerRow * SCORING.openChainMultiplier * level;
	const aminoAcids = rows * 4;
	const chainPoints = (chains * SCORING.chainBase + aminoAcids * SCORING.chainPerAminoAcid) * level;
	const unfinished = aminoAcids * SCORING.unfinishedPerAminoAcid;
	return rowPoints + chainPoints + unfinished;
}

/** Check a submission from the game. Never trust it: it comes from the player's browser. */
export function validateSubmission(input: unknown): Validation {
	if (typeof input !== 'object' || input === null) return fail('Invalid submission.');
	const data = input as Record<string, unknown>;

	const initials = typeof data.initials === 'string' ? data.initials.toUpperCase() : '';
	if (!/^[A-Z]{3}$/.test(initials)) return fail('Initials must be three letters, A to Z.');

	const numbers = [
		'score',
		'level',
		'rows',
		'chains',
		'longestChain',
		'durationMs',
		'generatorVersion'
	];
	for (const key of numbers) {
		if (!isCount(data[key])) return fail(`Invalid ${key}.`);
	}
	if (typeof data.tips !== 'boolean' || typeof data.offline !== 'boolean') {
		return fail('Invalid settings.');
	}

	const submission: Submission = {
		initials,
		score: data.score as number,
		level: data.level as number,
		rows: data.rows as number,
		chains: data.chains as number,
		longestChain: data.longestChain as number,
		durationMs: data.durationMs as number,
		generatorVersion: data.generatorVersion as number,
		tips: data.tips,
		offline: data.offline
	};

	if (submission.generatorVersion !== GENERATOR_VERSION) {
		return fail('This score was made with an older version of the game.');
	}
	if (submission.level !== levelFor(submission.rows)) return fail('Level does not match rows.');
	// Each row holds 4 codons; a chain needs at least 3 (start, one more, stop).
	if (submission.chains * 3 > submission.rows * 4) return fail('Too many chains for these rows.');
	if (submission.longestChain > submission.rows * 4) return fail('Chain too long for these rows.');
	if (submission.score > maxPlausibleScore(submission))
		return fail('Score is higher than possible.');
	if (submission.durationMs < submission.rows * MIN_MS_PER_ROW) return fail('Game was too fast.');

	return { ok: true, submission };
}
