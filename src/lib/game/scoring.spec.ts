import { describe, expect, it } from 'vitest';
import type { Base } from '../genetics/genetic-code';
import {
	SCORING,
	chainBonus,
	initialScore,
	levelFor,
	scoreClear,
	unfinishedChainPoints
} from './scoring';
import { initialTranslationState, readRows } from './translation';

/** The read events for rows given as text. */
const eventsFor = (...rows: string[]) =>
	readRows(
		initialTranslationState,
		rows.map((text) => text.split('') as Base[])
	).events;

describe('scoring', () => {
	it('scores rows cleared at once: 100, 300, 500, 800', () => {
		expect([1, 2, 3, 4].map((rows) => scoreClear(initialScore, rows, []).rowPoints)).toEqual([
			100, 300, 500, 800
		]);
	});

	it('multiplies row points by the level', () => {
		const atLevel3 = { score: 0, rows: 20, level: 3 };
		expect(scoreClear(atLevel3, 1, []).rowPoints).toBe(300);
	});

	it('goes up a level every 10 rows', () => {
		expect(levelFor(0)).toBe(1);
		expect(levelFor(9)).toBe(1);
		expect(levelFor(10)).toBe(2);
		const nearlyLevel2 = { score: 0, rows: 9, level: 1 };
		expect(scoreClear(nearlyLevel2, 1, []).state.level).toBe(2);
	});

	it('adds a chain bonus when a chain is completed', () => {
		// AUG GCU UGG UAA: Met, Ala, Trp, stop = a chain of 3 amino acids.
		const result = scoreClear(initialScore, 1, eventsFor('AUGGCUUGGUAA'));
		expect(result.chainPoints).toBe(chainBonus(3, 1));
		expect(result.state.score).toBe(100 + chainBonus(3, 1));
	});

	it('counts every chain completed in one clear', () => {
		// Two rows, each holding a complete 2-amino-acid chain.
		const result = scoreClear(initialScore, 2, eventsFor('AUGGCUUAACCC', 'AUGUGGUGACCC'));
		expect(result.chainPoints).toBe(2 * chainBonus(2, 1));
	});

	it('gives no chain bonus for a lone methionine', () => {
		expect(scoreClear(initialScore, 1, eventsFor('AUGUAGGCUCCC')).chainPoints).toBe(0);
	});

	it('values even the shortest chain above a single row', () => {
		expect(chainBonus(2, 1)).toBeGreaterThan(SCORING.rows[1]);
	});

	it('values longer chains more', () => {
		expect(chainBonus(10, 1)).toBeGreaterThan(chainBonus(3, 1));
	});

	it('values unfinished chains less than finished ones, but longer ones more', () => {
		expect(unfinishedChainPoints(null)).toBe(0);
		expect(unfinishedChainPoints(['M', 'A', 'W'])).toBe(30);
		for (let length = 2; length <= 100; length++) {
			const unfinished = unfinishedChainPoints(Array(length).fill('A'));
			expect(unfinished).toBeLessThan(chainBonus(length, 1));
		}
	});
});
