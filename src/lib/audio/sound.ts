/** The game's sound effects, generated in the browser (Web Audio), chiptune-style. */
export type Sound =
	'move' | 'turn' | 'land' | 'drop' | 'clear' | 'chain' | 'bank' | 'level' | 'over' | 'select';

/** Musical notes used below, in hertz. */
const NOTE = {
	G4: 392,
	F4: 349.23,
	Eb4: 311.13,
	C4: 261.63,
	A4: 440,
	C5: 523.25,
	E5: 659.25,
	G5: 783.99,
	A5: 880,
	B5: 987.77,
	C6: 1046.5,
	E6: 1318.51
};

let context: AudioContext | null = null;
/** Volume controls: one for sound effects, one for music. */
let soundGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let soundVolume = 0.8;
let musicVolume = 0.5;
let enabled = true;

export function setSoundEnabled(on: boolean) {
	enabled = on;
}

/** Sound effects volume, from 0 to 1. */
export function setSoundVolume(volume: number) {
	soundVolume = volume;
	if (soundGain) soundGain.gain.value = volume;
}

/** Music volume, from 0 to 1. */
export function setMusicVolume(volume: number) {
	musicVolume = volume;
	if (musicGain) musicGain.gain.value = volume;
}

/**
 * Browsers only allow sound after the player taps or presses something,
 * so this is called from the Start game button.
 */
export function unlockAudio() {
	if (typeof AudioContext === 'undefined') return;
	if (!context) {
		context = new AudioContext();
		soundGain = context.createGain();
		soundGain.gain.value = soundVolume;
		soundGain.connect(context.destination);
		musicGain = context.createGain();
		musicGain.gain.value = musicVolume;
		musicGain.connect(context.destination);
	}
	// Restart after any stop: "suspended" (not yet started), or "interrupted" (iPhone: a call,
	// Siri, or switching Airplane Mode can take over the audio until the next tap).
	if (context.state !== 'running') void context.resume();
	// On iPhones: respect the silent switch, and don't stop the player's own music.
	const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
	if (session) session.type = 'ambient';
}

/** For the music player: the shared audio context and the music's volume control. */
export function musicOutput(): { context: AudioContext; output: GainNode } | null {
	return context && musicGain && context.state === 'running'
		? { context, output: musicGain }
		: null;
}

interface ToneOptions {
	type?: OscillatorType;
	volume?: number;
	/** Slide the pitch to this frequency over the tone. */
	slideTo?: number;
}

/** One short tone, starting `start` seconds from now, fading out over `duration`. */
function tone(frequency: number, start: number, duration: number, options: ToneOptions = {}) {
	if (!context || !soundGain) return;
	const { type = 'square', volume = 0.06, slideTo } = options;
	const at = context.currentTime + start;
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, at);
	if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
	gain.gain.setValueAtTime(volume, at);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
	oscillator.connect(gain).connect(soundGain);
	oscillator.start(at);
	oscillator.stop(at + duration + 0.02);
}

/** Play a sound effect. `rows` is how many rows were cleared, for the 'clear' sound. */
export function play(sound: Sound, rows = 1) {
	if (!enabled || !context || context.state !== 'running') return;
	switch (sound) {
		case 'move':
			tone(220, 0, 0.03, { volume: 0.025 });
			break;
		case 'turn':
			tone(330, 0, 0.05, { volume: 0.035, slideTo: 440 });
			break;
		case 'land':
			tone(140, 0, 0.06, { type: 'triangle', volume: 0.12 });
			break;
		case 'drop':
			tone(180, 0, 0.1, { type: 'triangle', volume: 0.15, slideTo: 60 });
			break;
		case 'clear':
			[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]
				.slice(0, Math.max(1, Math.min(4, rows)))
				.forEach((note, i) => tone(note, i * 0.06, 0.1));
			break;
		case 'chain':
			tone(NOTE.A4, 0, 0.2, { slideTo: NOTE.A4 * 2 });
			break;
		case 'bank':
			tone(NOTE.B5, 0, 0.08, { volume: 0.07 });
			tone(NOTE.E6, 0.08, 0.3, { volume: 0.07 });
			break;
		case 'level':
			[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6].forEach((note, i) =>
				tone(note, i * 0.08, 0.12)
			);
			break;
		case 'over':
			[NOTE.G4, NOTE.F4, NOTE.Eb4, NOTE.C4].forEach((note, i) =>
				tone(note, i * 0.2, 0.28, { type: 'triangle', volume: 0.1 })
			);
			break;
		case 'select':
			tone(NOTE.E5, 0, 0.04, { volume: 0.03 });
			tone(NOTE.A5, 0.04, 0.06, { volume: 0.03 });
			break;
	}
}
