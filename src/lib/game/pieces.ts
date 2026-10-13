import { BASES, type Base } from '../genetics/genetic-code';
import { randomInt, type Random } from './random';

/**
 * The seven shapes, each drawn in a square box (x across, y down).
 * Positions follow the common modern standard.
 */
export const SHAPES = {
	I: {
		size: 4,
		squares: [
			[0, 1],
			[1, 1],
			[2, 1],
			[3, 1]
		]
	},
	O: {
		size: 2,
		squares: [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1]
		]
	},
	T: {
		size: 3,
		squares: [
			[1, 0],
			[0, 1],
			[1, 1],
			[2, 1]
		]
	},
	S: {
		size: 3,
		squares: [
			[1, 0],
			[2, 0],
			[0, 1],
			[1, 1]
		]
	},
	Z: {
		size: 3,
		squares: [
			[0, 0],
			[1, 0],
			[1, 1],
			[2, 1]
		]
	},
	J: {
		size: 3,
		squares: [
			[0, 0],
			[0, 1],
			[1, 1],
			[2, 1]
		]
	},
	L: {
		size: 3,
		squares: [
			[2, 0],
			[0, 1],
			[1, 1],
			[2, 1]
		]
	}
} as const;
export type ShapeName = keyof typeof SHAPES;
export const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[];

/** One square of a piece: its position in the piece's box, and its base. */
export interface Square {
	x: number;
	y: number;
	base: Base;
}

export interface Piece {
	shape: ShapeName;
	size: number;
	squares: Square[];
}

/**
 * Version of the piece generator. Change it whenever the way shapes or bases are chosen
 * changes, so scores are only compared between games that used the same rules.
 */
export const GENERATOR_VERSION = 1;

/** Make a piece of the given shape, giving each square a fully random base. */
export function createPiece(shape: ShapeName, random: Random): Piece {
	const { size, squares } = SHAPES[shape];
	return {
		shape,
		size,
		squares: squares.map(([x, y]) => ({ x, y, base: BASES[randomInt(random, BASES.length)] }))
	};
}

/** Turn a piece a quarter turn clockwise. Each base stays on its square. */
export function rotateClockwise(piece: Piece): Piece {
	const last = piece.size - 1;
	return {
		...piece,
		squares: piece.squares.map(({ x, y, base }) => ({ x: last - y, y: x, base }))
	};
}

/** Turn a piece a quarter turn anticlockwise. Each base stays on its square. */
export function rotateCounterClockwise(piece: Piece): Piece {
	const last = piece.size - 1;
	return {
		...piece,
		squares: piece.squares.map(({ x, y, base }) => ({ x: y, y: last - x, base }))
	};
}

/**
 * Deal pieces in "bags": each bag holds all seven shapes once, in random order,
 * which avoids long waits for any one shape.
 */
export function createPieceGenerator(random: Random): () => Piece {
	let bag: ShapeName[] = [];
	return () => {
		if (bag.length === 0) bag = shuffle([...SHAPE_NAMES], random);
		const shape = bag.pop() as ShapeName;
		return createPiece(shape, random);
	};
}

/** Shuffle a list in place (Fisher–Yates), and return it. */
function shuffle<T>(items: T[], random: Random): T[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = randomInt(random, i + 1);
		[items[i], items[j]] = [items[j] as T, items[i] as T];
	}
	return items;
}
