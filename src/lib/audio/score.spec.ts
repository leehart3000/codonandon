import { describe, expect, it } from 'vitest';
import { BASS_ROOTS, EIGHTHS_PER_BAR, MELODY, buildSteps, frequency, tempoFor } from './score';

describe('the music', () => {
	it('knows note frequencies', () => {
		expect(frequency('A4')).toBe(440);
		expect(frequency('A3')).toBe(220);
		expect(frequency('C5')).toBeCloseTo(523.25, 2);
		expect(() => frequency('H2')).toThrow();
	});

	it('has exactly 8 eighth notes in every bar, so the loop never drifts', () => {
		for (const bar of MELODY) {
			expect(bar.reduce((total, [, eighths]) => total + eighths, 0)).toBe(EIGHTHS_PER_BAR);
		}
		expect(BASS_ROOTS).toHaveLength(MELODY.length);
	});

	it('builds the loop step by step, with the beat in place', () => {
		const steps = buildSteps();
		expect(steps).toHaveLength(MELODY.length * EIGHTHS_PER_BAR);
		expect(steps[0]).toMatchObject({ kick: true, snare: false, hat: false });
		expect(steps[0]?.melody?.frequency).toBeCloseTo(frequency('G4'));
		expect(steps[0]?.bass?.frequency).toBeCloseTo(frequency('C3'));
		expect(steps[1]).toMatchObject({ kick: false, hat: true });
	});

	it('speeds up with the level, to a limit', () => {
		expect(tempoFor(1)).toBe(120);
		expect(tempoFor(5)).toBe(144);
		expect(tempoFor(100)).toBe(180);
	});
});
