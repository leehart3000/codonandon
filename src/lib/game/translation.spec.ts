import { describe, expect, it } from 'vitest';
import type { Base } from '../genetics/genetic-code';
import { initialTranslationState, readRows, rowToCodons } from './translation';

/** A row of bases from text, e.g. "AUGGCUUGGUAA". */
const row = (text: string) => text.split('') as Base[];

/** Read rows from the start, returning the event types and final chain. */
function read(...rows: string[]) {
	const { state, events } = readRows(initialTranslationState, rows.map(row));
	return { types: events.map((event) => event.type), events, chain: state.chain };
}

describe('translation', () => {
	it('splits a row into four codons, left to right', () => {
		expect(rowToCodons(row('AUGGCUUGGUAA'))).toEqual(['AUG', 'GCU', 'UGG', 'UAA']);
	});

	it('ignores codons until a start codon appears', () => {
		const result = read('GCUUGGCCCAAA');
		expect(result.types).toEqual(['outside', 'outside', 'outside', 'outside']);
		expect(result.chain).toBeNull();
	});

	it('makes a complete chain: start, amino acids, stop', () => {
		const result = read('AUGGCUUGGUAA');
		expect(result.types).toEqual(['start', 'add', 'add', 'complete']);
		expect(result.events[3]).toMatchObject({ type: 'complete', chain: ['M', 'A', 'W'] });
		expect(result.chain).toBeNull();
	});

	it('carries a chain across rows, bottom row first', () => {
		// Row 1: start, Ala, Lys, Gly. Row 2: Phe, stop, then two codons outside any chain.
		const result = read('AUGGCUAAAGGG', 'UUUUAACCCCCC');
		expect(result.types).toEqual([
			'start',
			'add',
			'add',
			'add',
			'add',
			'complete',
			'outside',
			'outside'
		]);
		expect(result.events[5]).toMatchObject({ chain: ['M', 'A', 'K', 'G', 'F'] });
	});

	it('treats AUG inside a chain as another methionine, not a restart', () => {
		const result = read('AUGAUGGCUUGA');
		expect(result.types).toEqual(['start', 'add', 'add', 'complete']);
		expect(result.events[3]).toMatchObject({ chain: ['M', 'M', 'A'] });
	});

	it('does not count a lone methionine as a chain', () => {
		const result = read('AUGUAGGCUCCC');
		expect(result.types).toEqual(['start', 'too-short', 'outside', 'outside']);
	});

	it('starts a new chain after completing one', () => {
		const result = read('AUGGCUUAAAUG');
		expect(result.types).toEqual(['start', 'add', 'complete', 'start']);
		expect(result.chain).toEqual(['M']);
	});

	it('keeps an unfinished chain open for later rows', () => {
		const result = read('CCCAUGGCUGGG');
		expect(result.types).toEqual(['outside', 'start', 'add', 'add']);
		expect(result.chain).toEqual(['M', 'A', 'G']);
	});
});
