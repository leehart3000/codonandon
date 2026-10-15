import { describe, expect, it } from 'vitest';
import type { Stats } from './game';
import { redundancyHighlight, summariseAminoAcids } from './summary';

/** Stats with just the codons that matter here. */
const stats = (codons: Stats['codons']): Stats => ({
	aminoAcids: {},
	codons,
	chains: 0,
	longestChain: 0,
	longestChainSequence: []
});

describe('game summary', () => {
	it('is empty when no amino acids were made', () => {
		expect(summariseAminoAcids(stats({}))).toEqual([]);
		expect(redundancyHighlight([])).toBeNull();
	});

	it('groups codons by amino acid, most-made first, then by name', () => {
		const summary = summariseAminoAcids(stats({ GCU: 2, GCC: 1, AUG: 3, UGG: 1 }));
		// Alanine (3) and Methionine (3) tie, so Alanine comes first alphabetically.
		expect(summary).toEqual([
			{ aminoAcid: 'A', count: 3, codons: ['GCC', 'GCU'] },
			{ aminoAcid: 'M', count: 3, codons: ['AUG'] },
			{ aminoAcid: 'W', count: 1, codons: ['UGG'] }
		]);
	});

	it('picks the amino acid made from the most different codons', () => {
		const summary = summariseAminoAcids(stats({ CUG: 1, UUA: 1, UUG: 1, GCU: 4, GCC: 1 }));
		// Leucine came from 3 codons; Alanine from 2.
		expect(redundancyHighlight(summary)?.aminoAcid).toBe('L');
	});

	it('has no highlight when every amino acid came from a single codon', () => {
		expect(redundancyHighlight(summariseAminoAcids(stats({ AUG: 2, UGG: 1 })))).toBeNull();
	});
});
