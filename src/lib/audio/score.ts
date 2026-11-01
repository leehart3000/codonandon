/**
 * Shared music notation (notes, steps and tunes), and the original tune, "Arcade":
 * an 8-bar chiptune loop in C major (chords C, Am, F, G).
 * Written as notes, so anyone can change it. Lengths are in eighth notes; each bar has 8.
 */

/** A note such as 'C5' (or null for a rest), and how many eighth notes it lasts. */
export type Note = [note: string | null, eighths: number];

export const EIGHTHS_PER_BAR = 8;

/** The melody, bar by bar: four bars of rising arpeggios, then an answering tune. */
export const MELODY: Note[][] = [
	[
		['G4', 1],
		['C5', 1],
		['E5', 1],
		['G5', 1],
		['E5', 1],
		['C5', 1],
		['E5', 1],
		['G5', 1]
	],
	[
		['A4', 1],
		['C5', 1],
		['E5', 1],
		['A5', 1],
		['G5', 1],
		['E5', 1],
		['C5', 1],
		['E5', 1]
	],
	[
		['F4', 1],
		['A4', 1],
		['C5', 1],
		['F5', 1],
		['E5', 1],
		['C5', 1],
		['A4', 1],
		['C5', 1]
	],
	[
		['G4', 1],
		['B4', 1],
		['D5', 1],
		['G5', 1],
		['F5', 1],
		['D5', 1],
		['B4', 1],
		['D5', 1]
	],
	[
		['E5', 2],
		['G5', 1],
		['A5', 1],
		['G5', 2],
		['E5', 2]
	],
	[
		['C6', 2],
		['B5', 1],
		['A5', 1],
		['G5', 2],
		['E5', 2]
	],
	[
		['F5', 1],
		['E5', 1],
		['D5', 1],
		['C5', 1],
		['D5', 2],
		['E5', 2]
	],
	[
		['D5', 2],
		['B4', 1],
		['C5', 1],
		['D5', 2],
		[null, 2]
	]
];

/** The bass: the root of each bar's chord, bouncing between two octaves. */
export const BASS_ROOTS = ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2'];

const SEMITONES: Record<string, number> = {
	C: 0,
	'C#': 1,
	D: 2,
	Eb: 3,
	E: 4,
	F: 5,
	'F#': 6,
	G: 7,
	Ab: 8,
	'G#': 8,
	A: 9,
	Bb: 10,
	B: 11
};

/** A note's frequency in hertz, from its name: A4 is 440 Hz. */
export function frequency(note: string): number {
	const match = /^([A-G](?:#|b)?)(\d)$/.exec(note);
	const semitone = match ? SEMITONES[match[1] ?? ''] : undefined;
	if (!match || semitone === undefined) throw new Error(`Unknown note: ${note}`);
	const midi = (Number(match[2]) + 1) * 12 + semitone;
	return 440 * 2 ** ((midi - 69) / 12);
}

/** The sounds a tune can use. The player (music.ts) decides how each one sounds. */
export type Instrument = 'lead' | 'bass' | 'pulse' | 'arp' | 'synth' | 'blip' | 'bell' | 'flute';

/** One note to play: on which instrument, at what pitch, and for how many steps. */
export interface Voice {
	instrument: Instrument;
	frequency: number;
	steps: number;
}

/** What happens on one step of a loop. */
export interface Step {
	voices: Voice[];
	kick: boolean;
	snare: boolean;
	hat: boolean;
}

/** A complete tune, ready to play. */
export interface Tune {
	id: string;
	/** Shown in Settings. */
	name: string;
	/** How many steps make one beat: 2 for eighth notes, 4 for sixteenth notes. */
	stepsPerBeat: number;
	steps: Step[];
	/** Drum sounds: 8-bit, heavier and metallic, or soft and light. */
	kit: 'chip' | 'industrial' | 'soft';
	/** Beats per minute on the menu screens (calmer, without drums). */
	menuTempo: number;
	/** Beats per minute during a game, faster with each level. */
	tempoFor(level: number): number;
}

/** The whole loop as eighth-note steps: kick on beats 1 and 3, snare on 2 and 4, hi-hat between. */
export function buildSteps(): Step[] {
	const steps: Step[] = Array.from({ length: MELODY.length * EIGHTHS_PER_BAR }, (_, i) => {
		const position = i % EIGHTHS_PER_BAR;
		return {
			voices: [],
			kick: position === 0 || position === 4,
			snare: position === 2 || position === 6,
			hat: position % 2 === 1
		};
	});

	let position = 0;
	for (const bar of MELODY) {
		for (const [note, eighths] of bar) {
			const step = steps[position];
			if (note && step)
				step.voices.push({ instrument: 'lead', frequency: frequency(note), steps: eighths });
			position += eighths;
		}
	}

	BASS_ROOTS.forEach((root, bar) => {
		for (const offset of [0, 2, 4, 6]) {
			const step = steps[bar * EIGHTHS_PER_BAR + offset];
			const octave = offset === 2 || offset === 6 ? 2 : 1;
			if (step)
				step.voices.push({ instrument: 'bass', frequency: frequency(root) * octave, steps: 2 });
		}
	});
	return steps;
}

/** Beats per minute: 120 at level 1, a little faster each level, up to 180. */
export function tempoFor(level: number): number {
	return Math.min(180, 120 + (level - 1) * 6);
}

/** The original tune: cheerful chiptune. */
export const ARCADE: Tune = {
	id: 'arcade',
	name: 'Arcade',
	stepsPerBeat: 2,
	steps: buildSteps(),
	kit: 'chip',
	menuTempo: 96,
	tempoFor
};
