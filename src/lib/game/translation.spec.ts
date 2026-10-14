import { describe, expect, it } from 'vitest';
import type { Base } from '../genetics/genetic-code';
import { frameOffset, initialTranslationState, readRows } from './translation';

/** A row of bases from text, e.g. "AUGGCUUGGUAA". */
const row = (text: string) => text.split('') as Base[];

/** Read rows from the start, returning the event types, events and final state. */
function read(...rows: string[]) {
	const { state, events } = readRows(initialTranslationState, rows.map(row));
	return { types: events.map((event) => event.type), events, state };
}

describe('translation', () => {
	it('ignores bases until a start codon appears', () => {
		const result = read('GCUUGGCCCAAA');
		expect(result.types).toEqual([]);
		expect(result.state.chain).toBeNull();
	});

	it('makes a complete chain: start, amino acids, stop', () => {
		const result = read('AUGGCUUGGUAA');
		expect(result.types).toEqual(['start', 'add', 'add', 'complete']);
		expect(result.events[3]).toMatchObject({ type: 'complete', chain: ['M', 'A', 'W'] });
		expect(result.state.chain).toBeNull();
	});

	it('finds AUG at any position, which sets the reading frame', () => {
		// C, then AUG GCU AAA, then CC left over.
		const result = read('CAUGGCUAAACC');
		expect(result.types).toEqual(['start', 'add', 'add']);
		expect(result.state.chain).toEqual(['M', 'A', 'K']);
		expect(result.state.pending).toEqual(['C', 'C']);
	});

	it('carries the reading frame across rows', () => {
		// Row 1: CC, AUG GCU AAA, then G left over. Row 2: GG completes GGG, then UAA stops.
		const result = read('CCAUGGCUAAAG', 'GGUAACCCCCCC');
		expect(result.types).toEqual(['start', 'add', 'add', 'add', 'complete']);
		expect(result.events[4]).toMatchObject({ chain: ['M', 'A', 'K', 'G'] });
	});

	it('finds an AUG split across two rows', () => {
		// Row 1 ends with AU; row 2 starts with G.
		const result = read('CCCCCCCCCCAU', 'GGCUUAACCCCC');
		expect(result.types).toEqual(['start', 'add', 'complete']);
		expect(result.events[2]).toMatchObject({ chain: ['M', 'A'] });
	});

	it('treats AUG inside a chain as another methionine, not a restart', () => {
		const result = read('AUGAUGGCUUGA');
		expect(result.types).toEqual(['start', 'add', 'add', 'complete']);
		expect(result.events[3]).toMatchObject({ chain: ['M', 'M', 'A'] });
	});

	it('does not count a lone methionine as a chain', () => {
		expect(read('AUGUAGGCUCCC').types).toEqual(['start', 'too-short']);
	});

	it('scans for a new start after completing a chain', () => {
		const result = read('AUGGCUUAAAUG');
		expect(result.types).toEqual(['start', 'add', 'complete', 'start']);
		expect(result.state.chain).toEqual(['M']);
	});

	it('keeps an unfinished chain open for later rows', () => {
		const result = read('CCCAUGGCUGGG');
		expect(result.types).toEqual(['start', 'add', 'add']);
		expect(result.state.chain).toEqual(['M', 'A', 'G']);
	});

	it('knows where the next codon starts in the next row', () => {
		expect(frameOffset(read('AUGGCUUGGGCA').state)).toBe(0);
		// One base (G) is left over, so columns 1–2 finish that codon, and the next starts at column 3.
		expect(frameOffset(read('CCAUGGCUAAAG').state)).toBe(2);
	});
});
