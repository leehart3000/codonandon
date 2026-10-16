import type { Action, ActionResult } from '../game/game';
import type { Sound } from './sound';

/** A sound to play, with how many rows were cleared (for the row-clear sound). */
export interface Cue {
	sound: Sound;
	rows?: number;
}

/** What happened to the piece, worked out by comparing it before and after the action. */
export interface Changes {
	moved: boolean;
	turned: boolean;
	levelledUp: boolean;
}

/**
 * Decide which sounds an action should make. One main sound per landing:
 * a banked chain (coin) beats a started chain, which beats a plain row clear.
 */
export function cuesFor(action: Action, result: ActionResult, changes: Changes): Cue[] {
	if (result.gameOver) return [{ sound: 'over' }];

	const cues: Cue[] = [];
	if (result.locked) {
		const clear = result.clear;
		if (clear) {
			const events = clear.events.map((event) => event.type);
			if (events.includes('complete')) cues.push({ sound: 'bank' });
			else if (events.includes('start')) cues.push({ sound: 'chain' });
			else cues.push({ sound: 'clear', rows: clear.rows.length });
		} else {
			cues.push({ sound: action === 'drop' ? 'drop' : 'land' });
		}
		if (changes.levelledUp) cues.push({ sound: 'level' });
	} else if (changes.turned) {
		cues.push({ sound: 'turn' });
	} else if (changes.moved && (action === 'left' || action === 'right')) {
		cues.push({ sound: 'move' });
	}
	return cues;
}
