import { describe, expect, it } from 'vitest';
import { BASES } from '../genetics/genetic-code';
import { createRandom } from './random';
import {
	SHAPE_NAMES,
	createPiece,
	createPieceGenerator,
	rotateClockwise,
	rotateCounterClockwise,
	type Piece
} from './pieces';

/** The occupied positions of a piece, ignoring bases, in a fixed order. */
const positions = (piece: Piece) => piece.squares.map(({ x, y }) => `${x},${y}`).sort();

/** The base at a given position, if any. */
const baseAt = (piece: Piece, x: number, y: number) =>
	piece.squares.find((square) => square.x === x && square.y === y)?.base;

describe('pieces', () => {
	it('has the seven standard shapes', () => {
		expect([...SHAPE_NAMES].sort()).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
	});

	it.each(SHAPE_NAMES)('%s has four squares inside its box, each with a base', (shape) => {
		const piece = createPiece(shape, createRandom(1));
		expect(piece.squares).toHaveLength(4);
		for (const square of piece.squares) {
			expect(square.x).toBeGreaterThanOrEqual(0);
			expect(square.x).toBeLessThan(piece.size);
			expect(square.y).toBeGreaterThanOrEqual(0);
			expect(square.y).toBeLessThan(piece.size);
			expect(BASES).toContain(square.base);
		}
	});

	it.each(SHAPE_NAMES)('%s is back where it started after four turns', (shape) => {
		const piece = createPiece(shape, createRandom(2));
		const turned = rotateClockwise(rotateClockwise(rotateClockwise(rotateClockwise(piece))));
		expect(turned).toEqual(piece);
	});

	it.each(SHAPE_NAMES)('%s: turning one way then back undoes the turn', (shape) => {
		const piece = createPiece(shape, createRandom(3));
		expect(rotateCounterClockwise(rotateClockwise(piece))).toEqual(piece);
	});

	it('turns T clockwise from pointing up to pointing right', () => {
		const piece = createPiece('T', createRandom(4));
		expect(positions(rotateClockwise(piece))).toEqual(['1,0', '1,1', '1,2', '2,1']);
	});

	it('keeps each base on its square when turning', () => {
		const piece = createPiece('T', createRandom(5));
		// The tip of the T moves from the top (1,0) to the right (2,1), carrying its base.
		expect(baseAt(rotateClockwise(piece), 2, 1)).toBe(baseAt(piece, 1, 0));
	});

	it('O keeps its outline when turned, but its bases move round', () => {
		const piece = createPiece('O', createRandom(6));
		const turned = rotateClockwise(piece);
		expect(positions(turned)).toEqual(positions(piece));
		// The bottom-left square moves to the top left.
		expect(baseAt(turned, 0, 0)).toBe(baseAt(piece, 0, 1));
	});
});

describe('piece generator', () => {
	it('deals the same pieces for the same seed', () => {
		const first = createPieceGenerator(createRandom(99));
		const second = createPieceGenerator(createRandom(99));
		for (let i = 0; i < 20; i++) expect(first()).toEqual(second());
	});

	it('deals every shape exactly once in each set of seven', () => {
		const next = createPieceGenerator(createRandom(5));
		for (let bag = 0; bag < 10; bag++) {
			const shapes = Array.from({ length: 7 }, () => next().shape).sort();
			expect(shapes).toEqual([...SHAPE_NAMES].sort());
		}
	});

	it('gives each base about a quarter of the time', () => {
		const next = createPieceGenerator(createRandom(2026));
		const counts = new Map<string, number>();
		for (let i = 0; i < 10_000; i++) {
			for (const square of next().squares) {
				counts.set(square.base, (counts.get(square.base) ?? 0) + 1);
			}
		}
		// 10,000 pieces × 4 squares = 40,000 bases: expect about 10,000 of each.
		for (const base of BASES) {
			expect(counts.get(base)).toBeGreaterThan(9_500);
			expect(counts.get(base)).toBeLessThan(10_500);
		}
	});
});
