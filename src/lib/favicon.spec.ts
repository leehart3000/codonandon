import { describe, expect, it } from 'vitest';
import { rotatedLogo } from './favicon';

describe('the turning tab icon', () => {
	const find = (turns: number, index: number) => rotatedLogo(turns).cells[index];

	it('starts as the logo: CODON over ANDON, five wide and two tall', () => {
		const logo = rotatedLogo(0);
		expect(logo).toMatchObject({ columns: 5, rows: 2 });
		expect(find(0, 0)).toMatchObject({ letter: 'C', column: 0, row: 0 });
		expect(find(0, 5)).toMatchObject({ letter: 'A', column: 0, row: 1 });
	});

	it('turns clockwise a quarter at a time, like a game piece', () => {
		expect(rotatedLogo(1)).toMatchObject({ columns: 2, rows: 5 });
		// Top-left goes to top-right; bottom-left goes to top-left.
		expect(find(1, 0)).toMatchObject({ letter: 'C', column: 1, row: 0 });
		expect(find(1, 5)).toMatchObject({ letter: 'A', column: 0, row: 0 });
		// Upside down after half a turn: C ends at the bottom right.
		expect(find(2, 0)).toMatchObject({ column: 4, row: 1 });
	});

	it('comes back to the start after four quarter turns', () => {
		expect(rotatedLogo(4)).toEqual(rotatedLogo(0));
	});

	it('keeps every square inside the block, with none overlapping', () => {
		for (let turns = 0; turns < 4; turns++) {
			const { cells, columns, rows } = rotatedLogo(turns);
			const places = new Set(cells.map(({ column, row }) => `${column},${row}`));
			expect(places.size).toBe(cells.length);
			for (const { column, row } of cells) {
				expect(column).toBeGreaterThanOrEqual(0);
				expect(column).toBeLessThan(columns);
				expect(row).toBeGreaterThanOrEqual(0);
				expect(row).toBeLessThan(rows);
			}
		}
	});
});
