import { START_CODON, translate, type Codon } from '../genetics/genetic-code';
import { BOARD_WIDTH, lock, type ActivePiece, type Board } from './board';
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
