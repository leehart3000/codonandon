import { describe, expect, it } from 'vitest';
import { PEPTIDES, describeLength } from './peptides';

describe('real peptides for comparison', () => {
	it('is listed shortest first', () => {
		const lengths = PEPTIDES.map((peptide) => peptide.length);
		expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
	});

	it('places a chain between two real ones', () => {
		expect(describeLength(38)).toBe(
			"longer than glucagon (29), but shorter than human insulin's two chains together (51)"
		);
	});

	it('notices an exact match', () => {
		expect(describeLength(9)).toBe('the same length as oxytocin');
	});

	it('handles very short and very long chains', () => {
		expect(describeLength(2)).toBe('shorter than oxytocin (9)');
		expect(describeLength(300)).toBe('longer than green fluorescent protein (238)');
	});
});
