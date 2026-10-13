import {
	START_CODON,
	translate,
	type AminoAcid,
	type Base,
	type Codon
} from '../genetics/genetic-code';

/** What happened when one codon was read. */
export type ReadEvent =
	/** Read while no chain is being made: no effect. */
	| { type: 'outside'; codon: Codon }
	/** AUG started a new chain, adding methionine. */
	| { type: 'start'; codon: Codon }
	/** An amino acid was added to the chain. */
	| { type: 'add'; codon: Codon; aminoAcid: AminoAcid }
	/** A stop codon finished the chain. */
	| { type: 'complete'; codon: Codon; chain: AminoAcid[] }
	/** A stop codon came straight after the start: a lone methionine isn't a chain. */
	| { type: 'too-short'; codon: Codon };

/** The chain currently being made (like a ribosome partway along the mRNA), if any. */
export interface TranslationState {
	chain: AminoAcid[] | null;
}

export const initialTranslationState: TranslationState = { chain: null };

/** Split a row of 12 bases into its 4 codons, left to right. */
export function rowToCodons(row: readonly Base[]): Codon[] {
	const codons: Codon[] = [];
	for (let i = 0; i + 3 <= row.length; i += 3) {
		codons.push(row.slice(i, i + 3).join('') as Codon);
	}
	return codons;
}

/** Read one codon. Returns the new state and what happened. */
export function readCodon(
	state: TranslationState,
	codon: Codon
): { state: TranslationState; event: ReadEvent } {
	const result = translate(codon);

	if (state.chain === null) {
		if (codon === START_CODON) return { state: { chain: ['M'] }, event: { type: 'start', codon } };
		return { state, event: { type: 'outside', codon } };
	}

	if (result === 'STOP') {
		const event: ReadEvent =
			state.chain.length >= 2
				? { type: 'complete', codon, chain: state.chain }
				: { type: 'too-short', codon };
		return { state: { chain: null }, event };
	}

	return {
		state: { chain: [...state.chain, result] },
		event: { type: 'add', codon, aminoAcid: result }
	};
}

/** Read cleared rows in order (bottom row first), each left to right. */
export function readRows(
	state: TranslationState,
	rows: readonly (readonly Base[])[]
): { state: TranslationState; events: ReadEvent[] } {
	const events: ReadEvent[] = [];
	let current = state;
	for (const row of rows) {
		for (const codon of rowToCodons(row)) {
			const read = readCodon(current, codon);
			current = read.state;
			events.push(read.event);
		}
	}
	return { state: current, events };
}
