import { describe, expect, it } from 'vitest';
import { createRandom, randomInt } from './random';

describe('seeded random numbers', () => {
	it('gives the same sequence for the same seed', () => {
		const first = createRandom(42);
		const second = createRandom(42);
		expect(Array.from({ length: 10 }, () => first())).toEqual(
			Array.from({ length: 10 }, () => second())
		);
	});

	it('gives different sequences for different seeds', () => {
		const one = createRandom(1);
		const two = createRandom(2);
		expect(Array.from({ length: 5 }, () => one())).not.toEqual(
			Array.from({ length: 5 }, () => two())
		);
	});

	it('always returns numbers from 0 up to 1', () => {
		const random = createRandom(7);
		const values = Array.from({ length: 10_000 }, () => random());
		expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...values)).toBeLessThan(1);
	});

	it('picks whole numbers evenly', () => {
		const random = createRandom(123);
		const counts = [0, 0, 0, 0];
		for (let i = 0; i < 40_000; i++) {
			const value = randomInt(random, 4);
			counts[value] = (counts[value] ?? 0) + 1;
		}
		for (const count of counts) {
			expect(count).toBeGreaterThan(9_500);
			expect(count).toBeLessThan(10_500);
		}
	});
});
