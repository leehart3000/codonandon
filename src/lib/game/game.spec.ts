import { describe, expect, it } from 'vitest';
import type { Base } from '../genetics/genetic-code';
import { BOARD_HEIGHT, createBoard, type Board } from './board';
import { createGame, fallInterval } from './game';
import { SHAPES, type Piece } from './pieces';
import { chainBonus } from './scoring';

/** An I piece with chosen bases, left to right. */
function iPiece(bases: string): Piece {
	return {
		shape: 'I',
		size: SHAPES.I.size,
		squares: SHAPES.I.squares.map(([x, y], i) => ({ x, y, base: bases[i] as Base }))
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

/** How many squares on the board hold a base. */
const filled = (board: Board) => board.flat().filter((cell) => cell !== null).length;

describe('game', () => {
	it('starts with a piece in play, the next piece ready, and no score', () => {
		const { state } = createGame({ seed: 1 });
		expect(state.active).not.toBeNull();
		expect(state.next.squares).toHaveLength(4);
		expect(state.score).toEqual({ score: 0, rows: 0, level: 1 });
		expect(state.over).toBe(false);
		expect(state.generatorVersion).toBe(1);
	});

	it('plays the same game for the same seed', () => {
		const first = createGame({ seed: 7 });
		const second = createGame({ seed: 7 });
		expect(first.state.active).toEqual(second.state.active);
		first.act('drop');
		second.act('drop');
		expect(first.state).toEqual(second.state);
	});

	it('moves the piece sideways, but not through the walls', () => {
		const game = createGame({ seed: 1 });
		const startX = game.state.active?.x ?? 0;
		game.act('left');
		expect(game.state.active?.x).toBe(startX - 1);
		for (let i = 0; i < 20; i++) game.act('left');
		const atWall = game.state.active?.x;
		game.act('left');
		expect(game.state.active?.x).toBe(atWall);
	});

	it('falls one row per tick', () => {
		const game = createGame({ seed: 1 });
		const startY = game.state.active?.y ?? 0;
		game.act('tick');
		expect(game.state.active?.y).toBe(startY + 1);
	});

	it('locks a dropped piece and brings in the next one', () => {
		const game = createGame({ seed: 1 });
		const next = game.state.next;
		const result = game.act('drop');
		expect(result.locked).toBe(true);
		expect(game.state.active?.piece).toEqual(next);
		expect(filled(game.state.board)).toBe(4);
	});

	it('clears a completed row, reads it and scores the chain', () => {
		// The I piece's bases CUUG complete the row as AUG GCU UGG UAA: Met, Ala, Trp, stop.
		const game = createGame({
			seed: 1,
			board: boardFrom(['AUGG....GUAA']),
			nextPiece: () => iPiece('CUUG')
		});
		const result = game.act('drop');
		expect(result.clear?.rows.map((row) => row.join(''))).toEqual(['AUGGCUUGGUAA']);
		expect(result.clear?.chainPoints).toBe(chainBonus(3, 1));
		expect(game.state.score.score).toBe(100 + chainBonus(3, 1));
		expect(game.state.stats).toMatchObject({
			chains: 1,
			longestChain: 3,
			aminoAcids: { M: 1, A: 1, W: 1 }
		});
		expect(filled(game.state.board)).toBe(0);
	});

	it('doubles row points while a chain is open, and banks the chain at a stop', () => {
		// Bottom row: AUG GCU UGG GCA starts a chain (Met, Ala, Trp, Ala).
		// The row above then becomes UAA CCU UGC CCC: its first codon is a stop.
		const game = createGame({
			seed: 1,
			board: boardFrom(['UAAC....CCCC', 'AUGG....GGCA']),
			nextPiece: () => iPiece('CUUG')
		});

		const first = game.act('drop');
		expect(first.clear?.multiplier).toBe(1);
		expect(game.state.translation.chain).toEqual(['M', 'A', 'W', 'A']);

		const second = game.act('drop');
		expect(second.clear?.multiplier).toBe(2);
		expect(second.clear?.rowPoints).toBe(200);
		expect(second.clear?.chainPoints).toBe(chainBonus(4, 1));
		expect(game.state.translation.chain).toBeNull();
	});

	it('ends the game when a new piece no longer fits, then ignores moves', () => {
		const game = createGame({ seed: 3 });
		for (let i = 0; i < 500 && !game.state.over; i++) game.act('drop');
		expect(game.state.over).toBe(true);
		expect(game.state.active).toBeNull();
		const finished = game.state;
		expect(game.act('left')).toEqual({ locked: false, clear: null, gameOver: null });
		expect(game.state).toBe(finished);
	});

	it('falls faster at higher levels, but never faster than every 0.1 seconds', () => {
		expect(fallInterval(1)).toBe(1000);
		expect(fallInterval(5)).toBeLessThan(fallInterval(1));
		expect(fallInterval(50)).toBe(100);
	});
});
