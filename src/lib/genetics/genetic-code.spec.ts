import { describe, expect, it } from 'vitest';
import { ALL_CODONS, AMINO_ACIDS, START_CODON, translate, type Codon } from './genetic-code';

describe('standard genetic code', () => {
	it('has 64 different codons', () => {
		expect(ALL_CODONS).toHaveLength(64);
		expect(new Set(ALL_CODONS).size).toBe(64);
	});

	it('reads AUG as methionine, and uses it as the start codon', () => {
		expect(START_CODON).toBe('AUG');
		expect(translate('AUG')).toBe('M');
	});

	it('has exactly three stop codons: UAA, UAG and UGA', () => {
		const stops = ALL_CODONS.filter((codon) => translate(codon) === 'STOP');
		expect([...stops].sort()).toEqual(['UAA', 'UAG', 'UGA']);
	});

	it('uses every one of the 20 amino acids', () => {
		const used = new Set(ALL_CODONS.map(translate).filter((result) => result !== 'STOP'));
		expect([...used].sort()).toEqual(Object.keys(AMINO_ACIDS).sort());
	});

	it.each([
		['L', 6],
		['S', 6],
		['R', 6],
		['A', 4],
		['G', 4],
		['M', 1],
		['W', 1]
	])('amino acid %s has %i codons', (aminoAcid, count) => {
		expect(ALL_CODONS.filter((codon) => translate(codon) === aminoAcid)).toHaveLength(count);
	});

	it.each([
		['UUU', 'F'],
		['UGG', 'W'],
		['GCA', 'A'],
		['AGA', 'R'],
		['CAU', 'H'],
		['GAG', 'E'],
		['UGU', 'C'],
		['AAA', 'K']
	])('reads %s as %s', (codon, aminoAcid) => {
		expect(translate(codon as Codon)).toBe(aminoAcid);
	});
});
