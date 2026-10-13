import { describe, expect, it } from 'vitest';
import type { Base } from '../genetics/genetic-code';
import {
	BOARD_HEIGHT,
	BOARD_WIDTH,
	clearFullRows,
	createBoard,
	drop,
	fits,
	lock,
	move,
	rotate,
	spawn,
	type Board
} from './board';
import { SHAPES, rotateClockwise, type Piece, type ShapeName } from './pieces';

/** A piece with chosen bases, given in the order of its squares. */
function piece(shape: ShapeName, bases = 'AAAA'): Piece {
	const { size, squares } = SHAPES[shape];
	return {
		shape,
		size,
		squares: squares.map(([x, y], i) => ({ x, y, base: bases[i] as Base }))
	};
}

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

describe('board', () => {
	it('starts empty: 20 rows of 12 cells', () => {
		const board = createBoard();
		expect(board).toHaveLength(BOARD_HEIGHT);
		for (const row of board) {
			expect(row).toHaveLength(BOARD_WIDTH);
			expect(row.every((cell) => cell === null)).toBe(true);
		}
	});

	it('spawns pieces centred at the top', () => {
		expect(spawn(piece('I')).x).toBe(4);
		expect(spawn(piece('T')).x).toBe(4);
		expect(spawn(piece('O')).x).toBe(5);
		expect(spawn(piece('T')).y).toBe(0);
	});

	it('stops pieces at the walls', () => {
		const board = createBoard();
		const atLeftWall = { piece: piece('I'), x: 0, y: 5 };
		expect(fits(board, atLeftWall)).toBe(true);
		expect(move(board, atLeftWall, -1, 0)).toBeNull();
		const atRightWall = { piece: piece('I'), x: BOARD_WIDTH - 4, y: 5 };
		expect(move(board, atRightWall, 1, 0)).toBeNull();
	});

	it('drops pieces to the floor', () => {
		const board = createBoard();
		// The T's squares are on the top two rows of its box, so it rests 2 rows up.
		expect(drop(board, spawn(piece('T'))).y).toBe(BOARD_HEIGHT - 2);
	});

	it('stops pieces on top of other bases', () => {
		const board = boardFrom(['AAAAAAAAAAA.']);
		expect(drop(board, spawn(piece('T'))).y).toBe(BOARD_HEIGHT - 3);
	});

	it('locks a piece into the board, keeping its bases in place', () => {
		const board = createBoard();
		const landed = drop(board, spawn(piece('I', 'AUGC')));
		const locked = lock(board, landed);
		expect(locked[BOARD_HEIGHT - 1]?.slice(4, 8)).toEqual(['A', 'U', 'G', 'C']);
		// The original board is unchanged.
		expect(board[BOARD_HEIGHT - 1]?.every((cell) => cell === null)).toBe(true);
	});

	it('nudges a piece away from the wall when turning', () => {
		const board = createBoard();
		// An upright I against the right wall can only lie flat if it moves left one square.
		const upright = { piece: rotateClockwise(piece('I')), x: BOARD_WIDTH - 3, y: 5 };
		expect(fits(board, upright)).toBe(true);
		expect(rotate(board, upright, 'anticlockwise')?.x).toBe(BOARD_WIDTH - 4);
	});

	it('clears full rows bottom first, and drops the rows above', () => {
		const board = boardFrom(['AUGAUGAUGAUG', 'C.C.C.C.C.C.', 'UAAUAAUAAUAA']);
		const { board: after, cleared } = clearFullRows(board);
		expect(cleared.map((row) => row.join(''))).toEqual(['UAAUAAUAAUAA', 'AUGAUGAUGAUG']);
		expect(after).toHaveLength(BOARD_HEIGHT);
		expect(after[BOARD_HEIGHT - 1]?.map((cell) => cell ?? '.').join('')).toBe('C.C.C.C.C.C.');
		expect(after[BOARD_HEIGHT - 2]?.every((cell) => cell === null)).toBe(true);
	});

	it('leaves the board alone when no rows are full', () => {
		const board = boardFrom(['AUGAUGAUGAU.']);
		const { board: after, cleared } = clearFullRows(board);
		expect(cleared).toEqual([]);
		expect(after).toEqual(board);
	});

	it('knows when the game is over: a new piece no longer fits', () => {
		const board = createBoard().map(() => Array<Base | null>(BOARD_WIDTH).fill('G'));
		expect(fits(board, spawn(piece('T')))).toBe(false);
	});
});
