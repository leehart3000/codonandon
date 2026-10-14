import { START_CODON, translate, type Codon } from '../genetics/genetic-code';
import { BOARD_WIDTH, lock, type ActivePiece, type Board } from './board';

/** A codon slot worth pointing out on the board. */
export interface CodonMark {
	row: number;
	/** Which of the row's 4 codon slots: 0 is columns 1–3, 1 is columns 4–6, and so on. */
	slot: number;
	kind: 'start' | 'stop';
}

/**
 * Codon slots whose three squares are all filled and that read as START (AUG) or STOP.
 * Slots are fixed groups of three columns: the reading frame.
 */
export function findMarks(board: Board): CodonMark[] {
	const marks: CodonMark[] = [];
	board.forEach((cells, row) => {
		for (let slot = 0; slot * 3 + 3 <= BOARD_WIDTH; slot++) {
			const bases = cells.slice(slot * 3, slot * 3 + 3);
			if (bases.some((base) => base === null)) continue;
			const codon = bases.join('') as Codon;
			if (codon === START_CODON) marks.push({ row, slot, kind: 'start' });
			else if (translate(codon) === 'STOP') marks.push({ row, slot, kind: 'stop' });
		}
	});
	return marks;
}

/** The marks that would be new if this piece landed where it is: used by the ghost piece. */
export function previewMarks(board: Board, landed: ActivePiece): CodonMark[] {
	const key = (mark: CodonMark) => `${mark.row}:${mark.slot}`;
	const existing = new Set(findMarks(board).map(key));
	return findMarks(lock(board, landed)).filter((mark) => !existing.has(key(mark)));
}
