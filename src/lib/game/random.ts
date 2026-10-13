/**
 * A small, fast random number generator that can be "seeded":
 * the same seed always gives the same sequence. That makes games repeatable,
 * which fair online scores, replays and tests all need.
 * Algorithm: Mulberry32.
 */
export type Random = () => number;

/** Create a generator. Each call returns a number from 0 up to (but not including) 1. */
export function createRandom(seed: number): Random {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A random whole number from 0 up to (but not including) max. */
export function randomInt(random: Random, max: number): number {
	return Math.floor(random() * max);
}
