import { describe, expect, it } from 'vitest';
import { GENERATOR_VERSION } from '../game/pieces';
import {
	INITIALS_ERROR,
	MIN_MS_PER_ROW,
	blockKey,
	maxPlausibleScore,
	validateSubmission
} from './scores';

/** A believable submission, with optional changes. */
const valid = (changes: Record<string, unknown> = {}) => ({
	initials: 'ABC',
	score: 20_000,
	level: 3,
	rows: 25,
	chains: 2,
	longestChain: 10,
	durationMs: 300_000,
	generatorVersion: GENERATOR_VERSION,
	tips: true,
	offline: false,
	...changes
});

const error = (changes: Record<string, unknown>) => {
	const result = validateSubmission(valid(changes));
	return result.ok ? null : result.error;
};

describe('high-score validation', () => {
	it('accepts a believable score', () => {
		expect(validateSubmission(valid())).toEqual({ ok: true, submission: valid() });
	});

	it('capitalises initials', () => {
		const result = validateSubmission(valid({ initials: 'abc' }));
		expect(result.ok && result.submission.initials).toBe('ABC');
	});

	it.each(['A', 'AB', 'A.B', 'J R', ' JR '])('accepts the initials "%s"', (initials) => {
		expect(validateSubmission(valid({ initials })).ok).toBe(true);
	});

	it.each(['ABCD', 'A1C', 'A-B', '', '   ', '...'])('rejects the initials "%s"', (initials) => {
		expect(error({ initials })).toBe(INITIALS_ERROR);
	});

	it('checks the blocklist by letters alone', () => {
		expect(blockKey('A.B')).toBe('AB');
		expect(blockKey('A B')).toBe('AB');
		expect(blockKey('ABC')).toBe('ABC');
	});

	it('rejects numbers that are negative or not whole', () => {
		expect(error({ score: -1 })).toBe('Invalid score.');
		expect(error({ rows: 2.5 })).toBe('Invalid rows.');
		expect(error({ chains: '2' })).toBe('Invalid chains.');
	});

	it('rejects scores from an older version of the piece rules', () => {
		expect(error({ generatorVersion: GENERATOR_VERSION + 1 })).toBe(
			'This score was made with an older version of the game.'
		);
	});

	it('rejects a level that does not match the rows', () => {
		expect(error({ level: 5 })).toBe('Level does not match rows.');
	});

	it('rejects more chains than the rows could hold', () => {
		expect(error({ chains: 40 })).toBe('Too many chains for these rows.');
	});

	it('rejects a score higher than possible', () => {
		const tooHigh = maxPlausibleScore({ rows: 25, chains: 2, level: 3 }) + 1;
		expect(error({ score: tooHigh })).toBe('Score is higher than possible.');
	});

	it('rejects a game that was impossibly fast', () => {
		expect(error({ durationMs: 25 * MIN_MS_PER_ROW - 1 })).toBe('Game was too fast.');
	});
});
