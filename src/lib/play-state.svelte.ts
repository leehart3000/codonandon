/**
 * Shared between components: whether a game is being played right now.
 * Used, for example, to keep the "new version" notice from interrupting a game.
 */
export const playState = $state({ playing: false });
