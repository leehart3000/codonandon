import { describe, expect, it } from 'vitest';
import {
	BASS_RIFF,
	BLIPS,
	CHORDS,
	LEAD,
	MAINFRAME,
	SIXTEENTHS_PER_BAR,
	buildMainframe,
	mainframeTempo
} from './mainframe';
import { frequency } from './score';
import { DEFAULT_TUNE, TUNES, tuneById } from './tunes';

describe('the Mainframe tune', () => {
	it('has exactly 16 sixteenth notes in every lead bar, so the loop never drifts', () => {
		for (const bar of LEAD) {
			expect(bar.reduce((total, [, sixteenths]) => total + sixteenths, 0)).toBe(SIXTEENTHS_PER_BAR);
		}
		expect(LEAD).toHaveLength(CHORDS.length);
		expect(BLIPS).toHaveLength(CHORDS.length);
		expect(BASS_RIFF).toHaveLength(SIXTEENTHS_PER_BAR);
	});

	it('builds the loop with the bass, arpeggio and beat in place', () => {
		const steps = buildMainframe();
		expect(steps).toHaveLength(CHORDS.length * SIXTEENTHS_PER_BAR);
		expect(steps[0]).toMatchObject({ kick: true, snare: false, hat: false });
		expect(steps[4]).toMatchObject({ snare: true });
		const bass = steps[0]?.voices.find((voice) => voice.instrument === 'pulse');
		expect(bass?.frequency).toBeCloseTo(frequency('A2'));
		const octave = steps[2]?.voices.find((voice) => voice.instrument === 'pulse');
		expect(octave?.frequency).toBeCloseTo(frequency('A3'));
		expect(steps[3]?.voices.some((voice) => voice.instrument === 'pulse')).toBe(false);
		// The arpeggio cycles three notes: the fourth step starts the cycle again.
		const arp = (index: number) =>
			steps[index]?.voices.find((voice) => voice.instrument === 'arp')?.frequency;
		expect(arp(3)).toBeCloseTo(arp(0) ?? 0);
	});

	it('speeds up with the level, to a limit', () => {
		expect(mainframeTempo(1)).toBe(104);
		expect(mainframeTempo(5)).toBe(120);
		expect(mainframeTempo(100)).toBe(150);
	});
});

describe('choosing a tune', () => {
	it('defaults to Mainframe, with Arcade still available', () => {
		expect(DEFAULT_TUNE).toBe(MAINFRAME);
		expect(TUNES.map((tune) => tune.name)).toEqual(['Mainframe', 'Arcade']);
		expect(tuneById('arcade').name).toBe('Arcade');
		expect(tuneById(null)).toBe(MAINFRAME);
		expect(tuneById('no-such-tune')).toBe(MAINFRAME);
	});

	it('gives every tune a unique id', () => {
		expect(new Set(TUNES.map((tune) => tune.id)).size).toBe(TUNES.length);
	});
});
