/**
 * The browser-tab icon, animated: the logo's block of squares turns a quarter at a time,
 * like a piece in the game, with its letters kept the right way up.
 * Browsers that can't change their tab icon simply keep showing the static one.
 */

/** The logo, as in static/icon.svg: CODON over ANDON. Letters without a square are bare green. */
const LOGO: { letter: string; colour: string | null }[] = [
	{ letter: 'C', colour: '#7aa8d6' },
	{ letter: 'O', colour: null },
	{ letter: 'D', colour: '#e3be71' },
	{ letter: 'O', colour: null },
	{ letter: 'N', colour: '#d97878' },
	{ letter: 'A', colour: '#7ec98f' },
	{ letter: 'N', colour: '#d97878' },
	{ letter: 'D', colour: '#e3be71' },
	{ letter: 'O', colour: null },
	{ letter: 'N', colour: '#d97878' }
];
const LOGO_COLUMNS = 5;

const BOARD = '#0f172a';
const BARE_LETTER = '#7ec98f';

/** Time between quarter turns. Browsers slow timers in background tabs, which is fine here. */
const TURN_MS = 1500;
/** Drawn at 64 × 64 pixels; browsers shrink it to fit the tab. */
const SIZE = 64;
const CELL = 12;

export interface Cell {
	letter: string;
	colour: string | null;
	column: number;
	row: number;
}

/** Where each square sits after this many quarter turns clockwise. */
export function rotatedLogo(turns: number): { cells: Cell[]; columns: number; rows: number } {
	let columns = LOGO_COLUMNS;
	let rows = LOGO.length / LOGO_COLUMNS;
	let cells: Cell[] = LOGO.map(({ letter, colour }, index) => ({
		letter,
		colour,
		column: index % LOGO_COLUMNS,
		row: Math.floor(index / LOGO_COLUMNS)
	}));
	for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn++) {
		// A clockwise quarter turn: the left column becomes the top row.
		const height = rows;
		cells = cells.map((cell) => ({ ...cell, column: height - 1 - cell.row, row: cell.column }));
		[columns, rows] = [rows, columns];
	}
	return { cells, columns, rows };
}

function draw(context: CanvasRenderingContext2D, turns: number) {
	const { cells, columns, rows } = rotatedLogo(turns);
	context.fillStyle = BOARD;
	context.fillRect(0, 0, SIZE, SIZE);
	// Squares sit a pixel apart, as on the board.
	const left = (SIZE - (columns * CELL - 1)) / 2;
	const top = (SIZE - (rows * CELL - 1)) / 2;
	context.font = `bold ${CELL - 3}px system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	for (const { letter, colour, column, row } of cells) {
		const x = left + column * CELL;
		const y = top + row * CELL;
		if (colour) {
			context.fillStyle = colour;
			context.fillRect(x, y, CELL - 1, CELL - 1);
		}
		context.fillStyle = colour ? BOARD : BARE_LETTER;
		context.fillText(letter, x + (CELL - 1) / 2, y + (CELL - 1) / 2 + 1);
	}
}

/**
 * Start turning the tab icon. Returns a function that stops it and restores the static icons.
 * Does nothing for people who prefer reduced motion.
 */
export function animateFavicon(): () => void {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	const context = canvas.getContext('2d');
	if (!context) return () => {};

	// The static icons would compete with the animated one, so set them aside while it runs.
	const staticIcons = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
	for (const icon of staticIcons) icon.remove();
	const link = document.createElement('link');
	link.rel = 'icon';
	link.type = 'image/png';
	document.head.appendChild(link);

	let turns = 0;
	const turn = () => {
		draw(context, turns);
		link.href = canvas.toDataURL('image/png');
		turns = (turns + 1) % 4;
	};
	turn();
	const timer = setInterval(turn, TURN_MS);

	return () => {
		clearInterval(timer);
		link.remove();
		for (const icon of staticIcons) document.head.appendChild(icon);
	};
}
