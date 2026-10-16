import { describe, expect, it } from 'vitest';
import type { ActionResult } from '../game/game';
import { cuesFor } from './cues';

/** A result with just the parts that matter here. */
const result = (parts: Partial<ActionResult>) => parts as ActionResult;
const none = { moved: false, turned: false, levelledUp: false };

/** A row clear with these reading events. */
const cleared = (rows: number, events: string[]) =>
	result({
		locked: true,
		clear: {
			rows: Array.from({ length: rows }, (_, i) => i),
			events: events.map((type) => ({ type }))
		} as unknown as ActionResult['clear']
	});

describe('sound cues', () => {
	it('blips when the piece moves sideways or turns', () => {
		expect(cuesFor('left', result({}), { ...none, moved: true })).toEqual([{ sound: 'move' }]);
		expect(cuesFor('rotate-clockwise', result({}), { ...none, turned: true })).toEqual([
			{ sound: 'turn' }
		]);
	});

	it('stays quiet when nothing changed, or when the piece just moves down', () => {
		expect(cuesFor('left', result({}), none)).toEqual([]);
		expect(cuesFor('down', result({}), { ...none, moved: true })).toEqual([]);
	});

	it('thuds on landing, more heavily for a drop', () => {
		expect(cuesFor('tick', result({ locked: true }), none)).toEqual([{ sound: 'land' }]);
		expect(cuesFor('drop', result({ locked: true }), none)).toEqual([{ sound: 'drop' }]);
	});

	it('plays one note per row cleared', () => {
		expect(cuesFor('drop', cleared(4, []), none)).toEqual([{ sound: 'clear', rows: 4 }]);
	});

	it('prefers a banked chain over a started one, and a started one over a plain clear', () => {
		expect(cuesFor('drop', cleared(1, ['add', 'complete', 'start']), none)).toEqual([
			{ sound: 'bank' }
		]);
		expect(cuesFor('drop', cleared(1, ['start', 'add']), none)).toEqual([{ sound: 'chain' }]);
	});

	it('adds a fanfare on level up, and only the game-over sound at the end', () => {
		expect(cuesFor('drop', cleared(1, []), { ...none, levelledUp: true })).toEqual([
			{ sound: 'clear', rows: 1 },
			{ sound: 'level' }
		]);
		expect(
			cuesFor('drop', result({ locked: true, gameOver: {} } as Partial<ActionResult>), none)
		).toEqual([{ sound: 'over' }]);
	});
});
