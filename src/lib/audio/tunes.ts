import { MAINFRAME } from './mainframe';
import { ARCADE, type Tune } from './score';

/** The tunes to choose from in Settings, the default first. Add new tunes here. */
export const TUNES: readonly Tune[] = [MAINFRAME, ARCADE];

export const DEFAULT_TUNE = MAINFRAME;

/** The tune with this id, or the default if there's no such tune (for example, a removed one). */
export function tuneById(id: string | null | undefined): Tune {
	return TUNES.find((tune) => tune.id === id) ?? DEFAULT_TUNE;
}
