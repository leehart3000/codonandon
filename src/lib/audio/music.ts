import { buildSteps, tempoFor, type Step } from './score';
import { musicOutput } from './sound';

/** The loop, worked out once. */
const STEPS = buildSteps();
/** Notes are scheduled slightly ahead, so timing stays steady even if the page is busy. */
const LOOKAHEAD = 0.12;
const INTERVAL_MS = 25;

/** The menu screens play a calmer version: slower, and without drums. */
export type MusicMode = 'menu' | 'game';
const MENU_TEMPO = 96;

let timer: ReturnType<typeof setInterval> | undefined;
let enabled = true;
let step = 0;
let nextTime = 0;
let tempo = 120;
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

function voice(
	context: AudioContext,
	output: AudioNode,
	frequency: number,
	at: number,
	duration: number,
	type: OscillatorType,
	volume: number
) {
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, at);
	gain.gain.setValueAtTime(volume, at);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + duration * 0.9);
	oscillator.connect(gain).connect(output);
	oscillator.start(at);
	oscillator.stop(at + duration);
}

function drum(
	context: AudioContext,
	output: AudioNode,
	at: number,
	kind: 'kick' | 'snare' | 'hat'
) {
	if (kind === 'kick') {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.frequency.setValueAtTime(150, at);
		oscillator.frequency.exponentialRampToValueAtTime(40, at + 0.12);
		gain.gain.setValueAtTime(0.4, at);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
		oscillator.connect(gain).connect(output);
		oscillator.start(at);
		oscillator.stop(at + 0.16);
		return;
	}
	const source = context.createBufferSource();
	source.buffer = noiseBuffer(context);
	const filter = context.createBiquadFilter();
	filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
	filter.frequency.value = kind === 'hat' ? 7000 : 1800;
	const gain = context.createGain();
	const length = kind === 'hat' ? 0.03 : 0.1;
	gain.gain.setValueAtTime(kind === 'hat' ? 0.06 : 0.12, at);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
	source.connect(filter).connect(gain).connect(output);
	source.start(at);
	source.stop(at + length + 0.01);
}

/** Schedule the notes due in the next moment. Runs every 25 ms while the music plays. */
function schedule() {
	const audio = musicOutput();
	if (!audio) return;
	const { context, output } = audio;
	const eighth = 60 / tempo / 2;
	if (nextTime < context.currentTime) nextTime = context.currentTime + 0.05;

	while (nextTime < context.currentTime + LOOKAHEAD) {
		const current: Step | undefined = STEPS[step];
		if (current?.melody) {
			voice(
				context,
				output,
				current.melody.frequency,
				nextTime,
				current.melody.eighths * eighth,
				'square',
				0.04
			);
		}
		if (current?.bass) {
			voice(
				context,
				output,
				current.bass.frequency,
				nextTime,
				current.bass.eighths * eighth,
				'triangle',
				0.12
			);
		}
		if (mode === 'game' && current?.kick) drum(context, output, nextTime, 'kick');
		if (mode === 'game' && current?.snare) drum(context, output, nextTime, 'snare');
		if (mode === 'game' && current?.hat) drum(context, output, nextTime, 'hat');
		nextTime += eighth;
		step = (step + 1) % STEPS.length;
	}
}

export function setMusicEnabled(on: boolean) {
	enabled = on;
	if (!on) stopMusic();
}

/** Play (or keep playing) the menu or game version. Safe to call often. */
export function playMusic(level: number, newMode: MusicMode = 'game') {
	// Switching between menu and game music starts the tune from the top.
	if (newMode !== mode) {
		mode = newMode;
		step = 0;
		nextTime = 0;
	}
	tempo = mode === 'menu' ? MENU_TEMPO : tempoFor(level);
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
