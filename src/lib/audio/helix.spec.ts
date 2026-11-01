import { describe, expect, it } from 'vitest';
import { CHORDS, EIGHTHS_PER_BAR, MELODY, STRANDS, buildHelix, helixTempo } from './helix';
import { frequency } from './score';

describe('the Helix tune', () => {
	it('has exactly 8 eighth notes in every bar, so the loop never drifts', () => {
		for (const bar of MELODY) {
			expect(bar.reduce((total, [, eighths]) => total + eighths, 0)).toBe(EIGHTHS_PER_BAR);
		}
		expect(MELODY).toHaveLength(CHORDS.length);
		expect(STRANDS).toHaveLength(EIGHTHS_PER_BAR);
	});

	it('winds two strands of bells: one climbing, one falling', () => {
		const climbing = STRANDS.filter((_, index) => index % 2 === 0);
		const falling = STRANDS.filter((_, index) => index % 2 === 1);
		expect(climbing).toEqual([0, 1, 2, 3]);
		expect(falling).toEqual([3, 2, 1, 0]);
	});

	it('builds the loop with the bells, bass and beat in place', () => {
		const steps = buildHelix();
		expect(steps).toHaveLength(CHORDS.length * EIGHTHS_PER_BAR);
		expect(steps[0]).toMatchObject({ kick: true, snare: false, hat: false });
		expect(steps[2]).toMatchObject({ snare: true });
		const voice = (index: number, instrument: string) =>
			steps[index]?.voices.find((each) => each.instrument === instrument)?.frequency;
		expect(voice(0, 'bell')).toBeCloseTo(frequency('D5'));
		expect(voice(1, 'bell')).toBeCloseTo(frequency('C#6'));
		expect(voice(0, 'bass')).toBeCloseTo(frequency('D3'));
		expect(voice(4, 'bass')).toBeCloseTo(frequency('D3') * 1.5);
	});

	it('speeds up with the level, to a limit', () => {
		expect(helixTempo(1)).toBe(92);
		expect(helixTempo(5)).toBe(112);
		expect(helixTempo(100)).toBe(150);
	});
});
