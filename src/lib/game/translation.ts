import {
	START_CODON,
	translate,
	type AminoAcid,
	type Base,
	type Codon
} from '../genetics/genetic-code';

/** What happened when a codon was read. */
export type ReadEvent =
	/** AUG started a new chain, adding methionine. */
	| { type: 'start'; codon: Codon }
	/** An amino acid was added to the chain. */
	| { type: 'add'; codon: Codon; aminoAcid: AminoAcid }
	/** A stop codon finished the chain. */
	| { type: 'complete'; codon: Codon; chain: AminoAcid[] }
	/** A stop codon came straight after the start: a lone methionine isn't a chain. */
	| { type: 'too-short'; codon: Codon };

/**
 * Where reading has got to along the strand.
 * - No chain: scanning base by base for AUG; `pending` holds the last two bases seen.
 * - Chain open: reading in threes from the start codon; `pending` holds the bases of an
 *   unfinished codon, carried over to the next row.
 */
export interface TranslationState {
	chain: AminoAcid[] | null;
	pending: Base[];
}

export const initialTranslationState: TranslationState = { chain: null, pending: [] };

/** Read one base. Returns the new state, and an event if a codon was completed. */
export function readBase(
	state: TranslationState,
	base: Base
): { state: TranslationState; event: ReadEvent | null } {
	const pending = [...state.pending, base];

	// Scanning: any three bases in a row spelling AUG start a chain and set the reading frame.
	if (state.chain === null) {
		if (pending.join('') === START_CODON) {
			return {
				state: { chain: ['M'], pending: [] },
				event: { type: 'start', codon: START_CODON }
			};
		}
		return { state: { chain: null, pending: pending.slice(-2) }, event: null };
	}

	// Reading in threes from the start codon.
	if (pending.length < 3) return { state: { chain: state.chain, pending }, event: null };

	const codon = pending.join('') as Codon;
	const result = translate(codon);
	if (result === 'STOP') {
		const event: ReadEvent =
			state.chain.length >= 2
				? { type: 'complete', codon, chain: state.chain }
				: { type: 'too-short', codon };
		return { state: { chain: null, pending: [] }, event };
	}
	return {
		state: { chain: [...state.chain, result], pending: [] },
		event: { type: 'add', codon, aminoAcid: result }
	};
}

/** Read cleared rows as one continuous strand: bottom row first, each left to right. */
export function readRows(
	state: TranslationState,
	rows: readonly (readonly Base[])[]
): { state: TranslationState; events: ReadEvent[] } {
	const events: ReadEvent[] = [];
	let current = state;
	for (const row of rows) {
		for (const base of row) {
			const read = readBase(current, base);
			current = read.state;
			if (read.event) events.push(read.event);
		}
	}
	return { state: current, events };
}

/**
 * While a chain is open: the column where the first complete codon starts in the next row
 * to be read. Rows are 12 bases long, a multiple of 3, so every row shares this frame.
 */
export function frameOffset(state: TranslationState): number {
	return (3 - state.pending.length) % 3;
}
