/**
 * "Mainframe": the default tune. An original 8-bar loop in A minor, darker and more
 * machine-like than "Arcade": a driving sixteenth-note bass, a fast arpeggio that runs
 * three notes against four like a data stream, computer blips, and heavy metallic drums.
 * Chords: Am, Am, F, E, Am, C, Bb, E (the E major and Bb give it its tense, hacker edge).
 * Lengths are in sixteenth notes; each bar has 16.
 */
import { frequency, type Note, type Step, type Tune } from './score';

export const SIXTEENTHS_PER_BAR = 16;

/** Each bar's chord: its bass root, and the three notes the arpeggio cycles through. */
export const CHORDS: { root: string; arpeggio: [string, string, string] }[] = [
	{ root: 'A2', arpeggio: ['A4', 'C5', 'E5'] },
	{ root: 'A2', arpeggio: ['A4', 'C5', 'E5'] },
	{ root: 'F2', arpeggio: ['F4', 'A4', 'C5'] },
	{ root: 'E2', arpeggio: ['E4', 'G#4', 'B4'] },
	{ root: 'A2', arpeggio: ['A4', 'C5', 'E5'] },
	{ root: 'C3', arpeggio: ['C5', 'E5', 'G5'] },
	{ root: 'Bb2', arpeggio: ['Bb4', 'D5', 'F5'] },
	{ root: 'E2', arpeggio: ['E4', 'G#4', 'B4'] }
];

/** The bass riff, in semitones above the bar's root, one per sixteenth (null: a gap). */
export const BASS_RIFF: (number | null)[] = [
	0,
	0,
	12,
	null,
	0,
	12,
	0,
	0,
	0,
	0,
	12,
	null,
	0,
	12,
	7,
	12
];

/** The lead: short calls in the first half, then a full theme in the second. */
export const LEAD: Note[][] = [
	[
		[null, 12],
		['E5', 2],
		['A5', 2]
	],
	[
		['C6', 4],
		['B5', 2],
		['A5', 2],
		[null, 8]
	],
	[
		[null, 12],
		['C5', 2],
		['F5', 2]
	],
	[
		['A5', 4],
		['G#5', 2],
		['E5', 2],
		[null, 8]
	],
	[
		['E5', 6],
		['D5', 2],
		['C5', 4],
		['B4', 4]
	],
	[
		['C5', 4],
		['E5', 4],
		['G5', 6],
		['F5', 2]
	],
	[
		['F5', 6],
		['D5', 2],
		['Bb4', 4],
		['A4', 4]
	],
	[
		['G#4', 8],
		['B4', 4],
		['E5', 4]
	]
];

/** Computer blips: [sixteenth in the bar, note], high and short. */
export const BLIPS: [number, string][][] = [
	[
		[3, 'A6'],
		[11, 'E6']
	],
	[
		[6, 'C7'],
		[14, 'A6']
	],
	[
		[3, 'F6'],
		[9, 'C7']
	],
	[
		[5, 'B6'],
		[13, 'G#6']
	],
	[
		[3, 'A6'],
		[7, 'E6'],
		[11, 'A6']
	],
	[
		[6, 'G6'],
		[14, 'C7']
	],
	[
		[3, 'D7'],
		[9, 'Bb6']
	],
	[
		[5, 'B6'],
		[10, 'E7'],
		[13, 'G#6']
	]
];

/** The beat, in sixteenths: a kick that pushes ahead, a backbeat snare, off-beat hi-hats. */
const KICKS = [0, 8, 11];
const SNARES = [4, 12];
const HATS = [2, 6, 10, 14];

/** The whole loop as sixteenth-note steps. */
export function buildMainframe(): Step[] {
	const steps: Step[] = Array.from({ length: CHORDS.length * SIXTEENTHS_PER_BAR }, (_, i) => {
		const position = i % SIXTEENTHS_PER_BAR;
		return {
			voices: [],
			kick: KICKS.includes(position),
			snare: SNARES.includes(position),
			hat: HATS.includes(position)
		};
	});

	CHORDS.forEach(({ root, arpeggio }, bar) => {
		const rootFrequency = frequency(root);
		for (let position = 0; position < SIXTEENTHS_PER_BAR; position++) {
			const index = bar * SIXTEENTHS_PER_BAR + position;
			const step = steps[index];
			if (!step) continue;
			const interval = BASS_RIFF[position];
			if (interval !== null && interval !== undefined) {
				step.voices.push({
					instrument: 'pulse',
					frequency: rootFrequency * 2 ** (interval / 12),
					steps: 1
				});
			}
			// Three notes cycling against four sixteenths: the pattern shifts every beat.
			const note = arpeggio[index % 3];
			if (note) step.voices.push({ instrument: 'arp', frequency: frequency(note), steps: 1 });
		}
	});

	let position = 0;
	for (const bar of LEAD) {
		for (const [note, sixteenths] of bar) {
			const step = steps[position];
			if (note && step) {
				step.voices.push({ instrument: 'synth', frequency: frequency(note), steps: sixteenths });
			}
			position += sixteenths;
		}
	}

	BLIPS.forEach((blips, bar) => {
		for (const [at, note] of blips) {
			steps[bar * SIXTEENTHS_PER_BAR + at]?.voices.push({
				instrument: 'blip',
				frequency: frequency(note),
				steps: 1
			});
		}
	});
	return steps;
}

/** Beats per minute: 104 at level 1, a little faster each level, up to 150. */
export function mainframeTempo(level: number): number {
	return Math.min(150, 104 + (level - 1) * 4);
}

export const MAINFRAME: Tune = {
	id: 'mainframe',
	name: 'Mainframe',
	stepsPerBeat: 4,
	steps: buildMainframe(),
	kit: 'industrial',
	menuTempo: 92,
	tempoFor: mainframeTempo
};
