import { describe, expect, it } from 'vitest';
import { START_CODON, translate } from '../genetics/genetic-code';
import { TIPS, tipForLevel } from './tips';

describe('level-up tips', () => {
	it('starts at level 1, one card per level, in order', () => {
		const levels = TIPS.map((tip) => tip.level);
		expect(levels[0]).toBe(1);
		expect(levels).toEqual([...new Set(levels)].sort((a, b) => a - b));
	});

	it('gives every card a title and some text', () => {
		for (const tip of TIPS) {
			expect(tip.title.length).toBeGreaterThan(0);
			expect(tip.text.length).toBeGreaterThan(0);
		}
	});

	it('only shows codons that really are start or stop codons', () => {
		for (const { codon, kind } of TIPS.flatMap((tip) => tip.codons ?? [])) {
			if (kind === 'start') expect(codon).toBe(START_CODON);
			else expect(translate(codon)).toBe('STOP');
		}
	});

	it('finds the card for a level, or nothing', () => {
		expect(tipForLevel(2)?.title).toBe('Start codon');
		expect(tipForLevel(99)).toBeUndefined();
	});
});
