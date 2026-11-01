import { type Tune, type Voice } from './score';
import { musicOutput } from './sound';
import { DEFAULT_TUNE } from './tunes';

/** Notes are scheduled slightly ahead, so timing stays steady even if the page is busy. */
const LOOKAHEAD = 0.12;
const INTERVAL_MS = 25;

/** The menu screens play a calmer version: slower, and without drums. */
export type MusicMode = 'menu' | 'game';

let timer: ReturnType<typeof setInterval> | undefined;
let enabled = true;
let tune: Tune = DEFAULT_TUNE;
let step = 0;
let nextTime = 0;
let tempo = DEFAULT_TUNE.tempoFor(1);
let level = 1;
let mode: MusicMode = 'game';
let noise: AudioBuffer | null = null;

/** Random "noise", for the snare and hi-hat, as on 8-bit machines. */
function noiseBuffer(context: AudioContext): AudioBuffer {
	if (!noise) {
		noise = context.createBuffer(1, Math.round(context.sampleRate * 0.2), context.sampleRate);
		const data = noise.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	}
	return noise;
}

interface ToneOptions {
	type: OscillatorType;
	volume: number;
	/** A low-pass filter whose cutoff sweeps from `from` to `to` hertz, for a buzzy, machine sound. */
	filter?: { from: number; to: number; resonance: number };
	/** A second oscillator slightly out of tune, for a thicker, synthesiser sound (in cents). */
	detune?: number;
	/** Fade in over this many seconds, for a softer start (like breath on a flute). */
	attack?: number;
}

function tone(
	context: AudioContext,
	output: AudioNode,
	frequency: number,
	at: number,
	duration: number,
	{ type, volume, filter, detune, attack }: ToneOptions
) {
	const gain = context.createGain();
	if (attack) {
		gain.gain.setValueAtTime(0.0001, at);
		gain.gain.linearRampToValueAtTime(volume, at + attack);
	} else {
		gain.gain.setValueAtTime(volume, at);
	}
	gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(duration * 0.9, (attack ?? 0) * 2));

	let input: AudioNode = gain;
	if (filter) {
		const lowPass = context.createBiquadFilter();
		lowPass.type = 'lowpass';
		lowPass.Q.value = filter.resonance;
		lowPass.frequency.setValueAtTime(filter.from, at);
		lowPass.frequency.exponentialRampToValueAtTime(filter.to, at + duration);
		lowPass.connect(gain);
		input = lowPass;
	}
	gain.connect(output);

	for (const cents of detune ? [-detune, detune] : [0]) {
		const oscillator = context.createOscillator();
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(frequency, at);
		oscillator.detune.value = cents;
		oscillator.connect(input);
		oscillator.start(at);
		oscillator.stop(at + duration);
	}
}

/** How each instrument sounds. */
function play(
	context: AudioContext,
	output: AudioNode,
	voice: Voice,
	at: number,
	stepTime: number
) {
	const duration = voice.steps * stepTime;
	const { frequency } = voice;
	switch (voice.instrument) {
		case 'lead':
			return tone(context, output, frequency, at, duration, { type: 'square', volume: 0.04 });
		case 'bass':
			return tone(context, output, frequency, at, duration, { type: 'triangle', volume: 0.12 });
		case 'pulse':
			// A short, resonant sawtooth: the driving, industrial bass.
			return tone(context, output, frequency, at, duration * 0.85, {
				type: 'sawtooth',
				volume: 0.08,
				filter: { from: 1600, to: 220, resonance: 8 }
			});
		case 'arp':
			// Quiet and clipped: a stream of data in the background.
			return tone(context, output, frequency, at, duration * 0.5, {
				type: 'square',
				volume: 0.014
			});
		case 'synth':
			return tone(context, output, frequency, at, duration, {
				type: 'sawtooth',
				volume: 0.035,
				filter: { from: 2600, to: 900, resonance: 2 },
				detune: 8
			});
		case 'blip':
			return tone(context, output, frequency, at, 0.05, { type: 'sine', volume: 0.03 });
		case 'bell':
			// A soft mallet: a pure tone that rings on, with a quiet, brighter strike on top.
			tone(context, output, frequency, at, 0.6, { type: 'sine', volume: 0.035 });
			return tone(context, output, frequency * 3, at, 0.15, { type: 'sine', volume: 0.008 });
		case 'flute':
			return tone(context, output, frequency, at, duration, {
				type: 'sine',
				volume: 0.05,
				attack: 0.04
			});
	}
}

function noiseHit(
	context: AudioContext,
	output: AudioNode,
	at: number,
	type: BiquadFilterType,
	cutoff: number,
	volume: number,
	length: number
) {
	const source = context.createBufferSource();
	source.buffer = noiseBuffer(context);
	const filter = context.createBiquadFilter();
	filter.type = type;
	filter.frequency.value = cutoff;
	const gain = context.createGain();
	gain.gain.setValueAtTime(volume, at);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
	source.connect(filter).connect(gain).connect(output);
	source.start(at);
	source.stop(at + length + 0.01);
}

function drum(
	context: AudioContext,
	output: AudioNode,
	at: number,
	kind: 'kick' | 'snare' | 'hat',
	kit: Tune['kit']
) {
	if (kind === 'kick') {
		const { from, to, volume, length } = KICKS[kit];
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.frequency.setValueAtTime(from, at);
		oscillator.frequency.exponentialRampToValueAtTime(to, at + length * 0.8);
		gain.gain.setValueAtTime(volume, at);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
		oscillator.connect(gain).connect(output);
		oscillator.start(at);
		oscillator.stop(at + length + 0.01);
		return;
	}
	if (kind === 'hat') {
		// Soft: a gentle shaker. Otherwise a crisp 8-bit hi-hat.
		if (kit === 'soft') noiseHit(context, output, at, 'highpass', 6000, 0.035, 0.06);
		else noiseHit(context, output, at, 'highpass', kit === 'industrial' ? 8000 : 7000, 0.06, 0.03);
		return;
	}
	if (kit === 'chip') {
		noiseHit(context, output, at, 'bandpass', 1800, 0.12, 0.1);
	} else if (kit === 'industrial') {
		// A hard noise crack, plus a short metallic clank.
		noiseHit(context, output, at, 'highpass', 900, 0.14, 0.12);
		tone(context, output, 330, at, 0.06, { type: 'square', volume: 0.025 });
		tone(context, output, 470, at, 0.05, { type: 'square', volume: 0.02 });
	} else {
		// A light rim click instead of a snare.
		noiseHit(context, output, at, 'highpass', 3000, 0.03, 0.03);
		tone(context, output, 1200, at, 0.03, { type: 'triangle', volume: 0.03 });
	}
}

/** Each kit's kick drum: a quick drop in pitch, from `from` to `to` hertz. */
const KICKS: Record<Tune['kit'], { from: number; to: number; volume: number; length: number }> = {
	chip: { from: 150, to: 40, volume: 0.4, length: 0.15 },
	industrial: { from: 130, to: 35, volume: 0.5, length: 0.22 },
	soft: { from: 110, to: 45, volume: 0.28, length: 0.18 }
};

/** Schedule the notes due in the next moment. Runs every 25 ms while the music plays. */
function schedule() {
	const audio = musicOutput();
	if (!audio) return;
	const { context, output } = audio;
	const stepTime = 60 / tempo / tune.stepsPerBeat;
	if (nextTime < context.currentTime) nextTime = context.currentTime + 0.05;

	while (nextTime < context.currentTime + LOOKAHEAD) {
		const current = tune.steps[step];
		for (const voice of current?.voices ?? []) play(context, output, voice, nextTime, stepTime);
		if (mode === 'game') {
			if (current?.kick) drum(context, output, nextTime, 'kick', tune.kit);
			if (current?.snare) drum(context, output, nextTime, 'snare', tune.kit);
			if (current?.hat) drum(context, output, nextTime, 'hat', tune.kit);
		}
		nextTime += stepTime;
		step = (step + 1) % tune.steps.length;
	}
}

function updateTempo() {
	tempo = mode === 'menu' ? tune.menuTempo : tune.tempoFor(level);
}

export function setMusicEnabled(on: boolean) {
	enabled = on;
	if (!on) stopMusic();
}

/** Choose the tune. A different tune starts from the top, straight away if music is playing. */
export function setTune(next: Tune) {
	if (next === tune) return;
	tune = next;
	step = 0;
	nextTime = 0;
	updateTempo();
}

/** Play (or keep playing) the menu or game version. Safe to call often. */
export function playMusic(newLevel: number, newMode: MusicMode = 'game') {
	// Switching between menu and game music starts the tune from the top.
	if (newMode !== mode) {
		mode = newMode;
		step = 0;
		nextTime = 0;
	}
	level = newLevel;
	updateTempo();
	if (!enabled || timer) return;
	nextTime = 0;
	schedule();
	timer = setInterval(schedule, INTERVAL_MS);
}

/** Stop scheduling notes; playing again carries on from the same place. */
export function stopMusic() {
	clearInterval(timer);
	timer = undefined;
}

/** For a new game: back to the start of the tune. */
export function restartMusic() {
	stopMusic();
	step = 0;
}
