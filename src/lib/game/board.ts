import type { Base } from '../genetics/genetic-code';
import { rotateClockwise, rotateCounterClockwise, type Piece } from './pieces';

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 20;

/** Each cell is either empty (null) or holds a base. */
export type Cell = Base | null;

/** Rows from the top (row 0) to the bottom (row BOARD_HEIGHT - 1). */
export type Board = Cell[][];

/** A piece in play: the piece, and where the top-left corner of its box is. */
export interface ActivePiece {
	piece: Piece;
	x: number;
	y: number;
}

/** An empty board. */
export function createBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null));
}

/** Put a new piece in play, centred at the top. */
export function spawn(piece: Piece): ActivePiece {
	return { piece, x: Math.floor((BOARD_WIDTH - piece.size) / 2), y: 0 };
}

/** Does the piece fit here: inside the board, and not overlapping anything? */
export function fits(board: Board, active: ActivePiece): boolean {
	return active.piece.squares.every(({ x, y }) => {
		const column = active.x + x;
		const row = active.y + y;
		return (
			column >= 0 &&
			column < BOARD_WIDTH &&
			row >= 0 &&
			row < BOARD_HEIGHT &&
			board[row]?.[column] === null
		);
	});
}

/** Move the piece by the given amount, or return null if it doesn't fit there. */
export function move(
	board: Board,
	active: ActivePiece,
	dx: number,
	dy: number
): ActivePiece | null {
	const moved = { ...active, x: active.x + dx, y: active.y + dy };
	return fits(board, moved) ? moved : null;
}

/** Sideways nudges to try when a turn doesn't fit, for example next to a wall. */
const KICKS = [0, -1, 1, -2, 2];

/** Turn the piece, nudging it sideways if needed, or return null if it can't turn. */
export function rotate(
	board: Board,
	active: ActivePiece,
	direction: 'clockwise' | 'anticlockwise'
): ActivePiece | null {
	const piece =
		direction === 'clockwise'
			? rotateClockwise(active.piece)
			: rotateCounterClockwise(active.piece);
	for (const kick of KICKS) {
		const turned = { piece, x: active.x + kick, y: active.y };
		if (fits(board, turned)) return turned;
	}
	return null;
}

/** Move the piece straight down as far as it can go. */
export function drop(board: Board, active: ActivePiece): ActivePiece {
	let current = active;
	for (let next = move(board, current, 0, 1); next; next = move(board, current, 0, 1)) {
		current = next;
	}
	return current;
}

/** Fix the piece into the board, where it is now. Returns a new board. */
export function lock(board: Board, active: ActivePiece): Board {
	const next = board.map((row) => [...row]);
	for (const { x, y, base } of active.piece.squares) {
		const row = next[active.y + y];
		if (row) row[active.x + x] = base;
	}
	return next;
}

/**
 * Remove all full rows. The rows above drop down, and empty rows are added at the top.
 * The cleared rows are returned bottom row first, each read left to right.
 */
export function clearFullRows(board: Board): { board: Board; cleared: Base[][] } {
	const cleared: Base[][] = [];
	const kept: Board = [];
	for (let row = board.length - 1; row >= 0; row--) {
		const cells = board[row] ?? [];
		if (cells.every((cell) => cell !== null)) cleared.push(cells as Base[]);
		else kept.unshift(cells);
	}
	while (kept.length < BOARD_HEIGHT) kept.unshift(Array<Cell>(BOARD_WIDTH).fill(null));
	return { board: kept, cleared };
}
