import { describe, expect, it } from 'vitest';
import type { Base } from '../genetics/genetic-code';
import { BOARD_HEIGHT, createBoard, type Board } from './board';
import { findMarks, previewMarks } from './highlights';
import { SHAPES, type Piece } from './pieces';

/** A board whose bottom rows are drawn as text: "." is empty, a letter is a base. */
function boardFrom(rows: string[]): Board {
	const board = createBoard();
	rows.forEach((text, i) => {
		board[BOARD_HEIGHT - rows.length + i] = text
			.split('')
			.map((cell) => (cell === '.' ? null : (cell as Base)));
	});
	return board;
}

const BOTTOM = BOARD_HEIGHT - 1;

describe('codon highlights', () => {
	it('marks AUG in a codon slot as a START', () => {
		expect(findMarks(boardFrom(['AUG.........']))).toEqual([
			{ row: BOTTOM, slot: 0, kind: 'start' }
		]);
	});

	it('marks UAA, UAG and UGA as STOPs', () => {
		expect(findMarks(boardFrom(['UAAUAGUGACCC']))).toEqual([
			{ row: BOTTOM, slot: 0, kind: 'stop' },
			{ row: BOTTOM, slot: 1, kind: 'stop' },
			{ row: BOTTOM, slot: 2, kind: 'stop' }
		]);
	});

	it('ignores slots that are not completely filled', () => {
		expect(findMarks(boardFrom(['AU.UA.......']))).toEqual([]);
	});

	it('respects the reading frame: an AUG across two slots does not count', () => {
		// Columns 2–4 spell AUG, but they belong to slots CAU and GAC.
		expect(findMarks(boardFrom(['CAUGAC......']))).toEqual([]);
	});

	it('previews the START a piece would make where it lands', () => {
		const board = boardFrom(['AU..........']);
		const piece: Piece = {
			shape: 'O',
			size: SHAPES.O.size,
			squares: SHAPES.O.squares.map(([x, y]) => ({ x, y, base: 'G' }))
		};
		// The O lands in columns 3–4 of the bottom two rows, completing A U G.
		const landed = { piece, x: 2, y: BOTTOM - 1 };
		expect(previewMarks(board, landed)).toEqual([{ row: BOTTOM, slot: 0, kind: 'start' }]);
	});

	it('does not preview marks that are already on the board', () => {
		const board = boardFrom(['AUG.........']);
		const piece: Piece = {
			shape: 'O',
			size: SHAPES.O.size,
			squares: SHAPES.O.squares.map(([x, y]) => ({ x, y, base: 'C' }))
		};
		const landed = { piece, x: 6, y: BOTTOM - 1 };
		expect(previewMarks(board, landed)).toEqual([]);
	});
});
