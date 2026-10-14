import { START_CODON, translate, type Codon } from '../genetics/genetic-code';
import { BOARD_WIDTH, drop, fits, lock, type ActivePiece, type Board } from './board';
import { rotateClockwise, type Piece } from './pieces';
import { frameOffset, type TranslationState } from './translation';

/** Three squares in a row worth pointing out on the board. */
export interface CodonMark {
	row: number;
	/** The column of the first of the three squares. */
	column: number;
	kind: 'start' | 'stop';
}

/**
 * What to point out depends on the chain:
 * - No chain open: every AUG, at any position, is a possible START.
 * - Chain open: STOPs that are in the current reading frame.
 */
export function findMarks(board: Board, translation: TranslationState): CodonMark[] {
	const chainOpen = translation.chain !== null;
	const offset = frameOffset(translation);
	const marks: CodonMark[] = [];

	board.forEach((cells, row) => {
		for (let column = 0; column + 3 <= BOARD_WIDTH; column++) {
			if (chainOpen && (column < offset || (column - offset) % 3 !== 0)) continue;
			const bases = cells.slice(column, column + 3);
			if (bases.some((base) => base === null)) continue;
			const codon = bases.join('') as Codon;
			if (!chainOpen && codon === START_CODON) marks.push({ row, column, kind: 'start' });
			if (chainOpen && translate(codon) === 'STOP') marks.push({ row, column, kind: 'stop' });
		}
	});
	return marks;
}

/** The marks that would be new if this piece landed where it is: used by the ghost piece. */
export function previewMarks(
	board: Board,
	landed: ActivePiece,
	translation: TranslationState
): CodonMark[] {
	const key = (mark: CodonMark) => `${mark.row}:${mark.column}`;
	const existing = new Set(findMarks(board, translation).map(key));
	return findMarks(lock(board, landed), translation).filter((mark) => !existing.has(key(mark)));
}

/** Squares to highlight as an opportunity: bases already on the board, and squares of the piece. */
export interface Opportunities {
	/** What the opportunity would form: a START, or (with a chain open) a STOP. */
	kind: 'start' | 'stop';
	cells: { row: number; column: number }[];
	/** Positions in the piece's list of squares, which stay the same when it turns. */
	squares: number[];
}

/**
 * Try the piece in every rotation and column (straight drops only), and find where it would
 * form something useful: a new START when no chain is open, or a new in-frame STOP when one is.
 */
export function findOpportunities(
	board: Board,
	piece: Piece,
	translation: TranslationState
): Opportunities {
	const wanted = translation.chain === null ? 'start' : 'stop';
	const cells = new Map<string, { row: number; column: number }>();
	const squares = new Set<number>();

	let turned = piece;
	for (let turn = 0; turn < 4; turn++) {
		for (let x = -piece.size; x <= BOARD_WIDTH; x++) {
			const above = { piece: turned, x, y: 0 };
			if (!fits(board, above)) continue;
			const landed = drop(board, above);

			for (const mark of previewMarks(board, landed, translation)) {
				if (mark.kind !== wanted) continue;
				for (let column = mark.column; column < mark.column + 3; column++) {
					if (board[mark.row]?.[column]) {
						cells.set(`${mark.row}:${column}`, { row: mark.row, column });
					} else {
						const index = landed.piece.squares.findIndex(
							(square) => landed.x + square.x === column && landed.y + square.y === mark.row
						);
						if (index >= 0) squares.add(index);
					}
				}
			}
		}
		turned = rotateClockwise(turned);
	}

	return {
		kind: wanted,
		cells: [...cells.values()],
		squares: [...squares].sort((a, b) => a - b)
	};
}
