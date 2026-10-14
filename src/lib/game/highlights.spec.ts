import { describe, expect, it } from 'vitest';
import type { Base } from '../genetics/genetic-code';
import { BOARD_HEIGHT, createBoard, type Board } from './board';
import { findMarks, previewMarks } from './highlights';
import { SHAPES, type Piece } from './pieces';
import { initialTranslationState, type TranslationState } from './translation';

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

/** An O piece with all four squares set to one base. */
function oPiece(base: Base): Piece {
	return {
		shape: 'O',
		size: SHAPES.O.size,
		squares: SHAPES.O.squares.map(([x, y]) => ({ x, y, base }))
	};
}

const BOTTOM = BOARD_HEIGHT - 1;
const scanning = initialTranslationState;
const chainOpen = (pending: Base[] = []): TranslationState => ({ chain: ['M'], pending });

describe('codon highlights', () => {
	it('with no chain, marks an AUG at any position as a START', () => {
		expect(findMarks(boardFrom(['CAUG........']), scanning)).toEqual([
			{ row: BOTTOM, column: 1, kind: 'start' }
		]);
	});

	it('with no chain, does not mark STOPs', () => {
		expect(findMarks(boardFrom(['UAA.........']), scanning)).toEqual([]);
	});

	it('ignores squares that are not filled', () => {
		expect(findMarks(boardFrom(['AU.UA.......']), scanning)).toEqual([]);
	});

	it('with a chain open, marks STOPs in the reading frame', () => {
		expect(findMarks(boardFrom(['UAAUAGUGACCC']), chainOpen())).toEqual([
			{ row: BOTTOM, column: 0, kind: 'stop' },
			{ row: BOTTOM, column: 3, kind: 'stop' },
			{ row: BOTTOM, column: 6, kind: 'stop' }
		]);
	});

	it('with a chain open, ignores STOPs outside the reading frame', () => {
		// One base is pending, so codons in the next row start at column 3 (index 2).
		expect(findMarks(boardFrom(['GGUAACCCCCCC']), chainOpen(['G']))).toEqual([
			{ row: BOTTOM, column: 2, kind: 'stop' }
		]);
		expect(findMarks(boardFrom(['UAAUAACCCCCC']), chainOpen(['G']))).toEqual([]);
	});

	it('previews the START a piece would make where it lands', () => {
		// The O lands in columns 3–4 of the bottom two rows, completing A U G.
		const landed = { piece: oPiece('G'), x: 2, y: BOTTOM - 1 };
		expect(previewMarks(boardFrom(['AU..........']), landed, scanning)).toEqual([
			{ row: BOTTOM, column: 0, kind: 'start' }
		]);
	});

	it('does not preview marks that are already on the board', () => {
		const landed = { piece: oPiece('C'), x: 6, y: BOTTOM - 1 };
		expect(previewMarks(boardFrom(['AUG.........']), landed, scanning)).toEqual([]);
	});
});
