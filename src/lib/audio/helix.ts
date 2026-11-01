/**
 * "Helix": a calm, bright tune, to sit between dark "Mainframe" and cheerful "Arcade".
 * An original 8-bar loop in D major: soft bell arpeggios wind up and down at the same time,
 * like the two strands of a double helix, under a gentle flute-like tune, a round bass
 * and a light shaker beat. Chords: Dmaj7, Bm7, Gmaj7, A, Dmaj7, F#m7, Gmaj7, Asus4.
 * Lengths are in eighth notes; each bar has 8.
 */
import { frequency, type Note, type Step, type Tune } from './score';

export const EIGHTHS_PER_BAR = 8;

/** Each bar's chord: its bass root, and four notes for the bells, low to high. */
export const CHORDS: { root: string; bells: [string, string, string, string] }[] = [
	{ root: 'D3', bells: ['D5', 'F#5', 'A5', 'C#6'] },
	{ root: 'B2', bells: ['B4', 'D5', 'F#5', 'A5'] },
	{ root: 'G2', bells: ['G4', 'B4', 'D5', 'F#5'] },
	{ root: 'A2', bells: ['A4', 'C#5', 'E5', 'A5'] },
	{ root: 'D3', bells: ['D5', 'F#5', 'A5', 'C#6'] },
	{ root: 'F#2', bells: ['F#4', 'A4', 'C#5', 'E5'] },
	{ root: 'G2', bells: ['G4', 'B4', 'D5', 'F#5'] },
	{ root: 'A2', bells: ['A4', 'D5', 'E5', 'A5'] }
];

/**
 * The bells' order in each bar: one strand climbing (0, 1, 2, 3) and one falling (3, 2, 1, 0),
 * taking turns, so the two strands wind round each other.
 */
export const STRANDS = [0, 3, 1, 2, 2, 1, 3, 0] as const;

/** The tune, mostly from the D major pentatonic scale (D, E, F#, A, B). */
export const MELODY: Note[][] = [
	[
		[null, 4],
		['A5', 2],
		['F#5', 2]
	],
	[
		['B5', 3],
		['A5', 1],
		['F#5', 4]
	],
	[
		[null, 2],
		['E5', 2],
		['F#5', 2],
		['A5', 2]
	],
	[
		['E5', 6],
		[null, 2]
	],
	[
		['F#5', 2],
		['A5', 2],
		['D6', 4]
	],
	[
		['C#6', 3],
		['B5', 1],
		['A5', 4]
	],
	[
		['B5', 2],
		['A5', 2],
		['F#5', 2],
		['E5', 2]
	],
	[
		['D5', 6],
		[null, 2]
	]
];

/** A light beat, in eighths: a soft kick, a rim click on beats 2 and 4, a shaker between. */
const KICKS = [0, 5];
const RIMS = [2, 6];
const SHAKERS = [1, 3, 5, 7];

/** The whole loop as eighth-note steps. */
export function buildHelix(): Step[] {
	const steps: Step[] = Array.from({ length: CHORDS.length * EIGHTHS_PER_BAR }, (_, i) => {
		const position = i % EIGHTHS_PER_BAR;
		return {
			voices: [],
			kick: KICKS.includes(position),
			snare: RIMS.includes(position),
			hat: SHAKERS.includes(position)
		};
	});

	CHORDS.forEach(({ root, bells }, bar) => {
		const start = bar * EIGHTHS_PER_BAR;
		STRANDS.forEach((strand, position) => {
			const note = bells[strand];
			if (note) {
				steps[start + position]?.voices.push({
					instrument: 'bell',
					frequency: frequency(note),
					steps: 1
				});
			}
		});
		// The bass: the root, its fifth, then the root again.
		const bass = frequency(root);
		const pattern: [offset: number, multiple: number, eighths: number][] = [
			[0, 1, 3],
			[4, 1.5, 2],
			[6, 1, 2]
		];
		for (const [offset, multiple, eighths] of pattern) {
			steps[start + offset]?.voices.push({
				instrument: 'bass',
				frequency: bass * multiple,
				steps: eighths
			});
		}
	});

	let position = 0;
	for (const bar of MELODY) {
		for (const [note, eighths] of bar) {
			const step = steps[position];
			if (note && step) {
				step.voices.push({ instrument: 'flute', frequency: frequency(note), steps: eighths });
			}
			position += eighths;
		}
	}
	return steps;
}

/** Beats per minute: 92 at level 1, a little faster each level, up to 150. */
export function helixTempo(level: number): number {
	return Math.min(150, 92 + (level - 1) * 5);
}

export const HELIX: Tune = {
	id: 'helix',
	name: 'Helix',
	stepsPerBeat: 2,
	steps: buildHelix(),
	kit: 'soft',
	menuTempo: 80,
	tempoFor: helixTempo
};
