<script lang="ts">
	import { onMount } from 'svelte';

	/** Falling genetic-code letters (A, U, G, C), in the style of film "code rain". Decoration only. */
	let { height = 64 }: { height?: number } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	const LETTERS = ['A', 'U', 'G', 'C'];
	/** Size of one letter's square, in pixels: letters almost touch. */
	const COLUMN = 6;
	const ROW = 6;
	const FONT_SIZE = 8;
	/** Time between updates: higher is slower. Each column moves at its own speed within this. */
	const FRAME_MS = 60;
	/** Each stream's length, in letters: a random length between these. */
	const SHORTEST = 8;
	const LONGEST = 25;
	/** How long an empty gap can be before a column's next stream (in screen heights). */
	const LONGEST_GAP = 5;
	/** The share of letters turned by a right angle, and the share mirrored: more look "alien". */
	const TURNED = 0.2;
	const MIRRORED = 0;
	/** How many letters within the streams change each update. */
	const FLICKER = 1;
	/** The menu background: clears squares, and dims everything very slightly. */
	const BACKGROUND = '#0f172a';
	/** How much the streams fade each update: 0 for none; higher fades faster. */
	const DIMMING = 0.08;
	const DIM = `rgba(15, 23, 42, ${DIMMING})`;
	const TRAIL = '#7ec98f';
	const HEAD = '#ecfdf5';

	const randomLetter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)] ?? 'A';
	/** Rows per update: slow columns step only now and then. */
	const randomSpeed = () => 0.3 + Math.random() * 0.7;
	const randomLength = () => SHORTEST + Math.floor(Math.random() * (LONGEST - SHORTEST + 1));

	interface Stream {
		/** How far down the head is, in rows (negative: still waiting above, an empty gap). */
		row: number;
		speed: number;
		length: number;
	}

	onMount(() => {
		const element = canvas;
		const context = element?.getContext('2d');
		if (!element || !context) return;

		const scale = window.devicePixelRatio || 1;
		let width = 0;
		const rows = () => height / ROW;
		let streams: Stream[] = [];

		/** A new stream, starting somewhere above the top: the further up, the longer the gap. */
		const newStream = (): Stream => ({
			row: -Math.random() * rows() * LONGEST_GAP,
			speed: randomSpeed(),
			length: randomLength()
		});

		function resize() {
			if (!element || !context) return;
			width = element.clientWidth;
			element.width = Math.round(width * scale);
			element.height = Math.round(height * scale);
			context.setTransform(scale, 0, 0, scale, 0, 0);
			// Menlo is on every Mac and iPhone, so the rain looks the same in Safari and Chrome.
			context.font = `${FONT_SIZE}px Menlo, ui-monospace, monospace`;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			streams = Array.from({ length: Math.ceil(width / COLUMN) }, newStream);
		}

		function erase(column: number, row: number) {
			context?.fillRect.call(context, column * COLUMN, row * ROW, COLUMN, ROW);
		}

		/** Clear one square, then draw a single letter in it, sometimes turned or mirrored. */
		function cell(column: number, row: number, colour: string, glow = false) {
			if (!context) return;
			context.fillStyle = BACKGROUND;
			erase(column, row);
			context.save();
			context.translate(column * COLUMN + COLUMN / 2, row * ROW + ROW / 2);
			if (Math.random() < TURNED)
				context.rotate((1 + Math.floor(Math.random() * 3)) * (Math.PI / 2));
			if (Math.random() < MIRRORED) context.scale(-1, 1);
			context.shadowColor = TRAIL;
			context.shadowBlur = glow ? 8 : 0;
			context.fillStyle = colour;
			context.fillText(randomLetter(), 0, 0);
			context.restore();
		}

		resize();

		// Reduced motion: a still scattering of letters instead.
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			context.fillStyle = 'rgba(126, 201, 143, 0.5)';
			for (let i = 0; i < width / 3; i++) {
				context.fillText(randomLetter(), Math.random() * width, Math.random() * height);
			}
			return;
		}

		let frame = 0;
		let last = 0;
		function step(now: number) {
			frame = requestAnimationFrame(step);
			if (!context || now - last < FRAME_MS) return;
			last = now;

			// Dim everything very slightly: letters stay bright until their stream's tail passes.
			context.fillStyle = DIM;
			context.fillRect(0, 0, width, height);

			streams.forEach((stream, column) => {
				const before = Math.floor(stream.row);
				stream.row += stream.speed;
				const after = Math.floor(stream.row);
				if (after !== before) {
					// The old head joins the stream, a new glowing head appears below,
					// and the tail end is erased, leaving an empty gap above.
					cell(column, before, TRAIL);
					cell(column, after, HEAD, true);
					context.fillStyle = BACKGROUND;
					erase(column, after - stream.length);
				}
				// Once the whole stream has passed the bottom, start a new one above.
				if (stream.row - stream.length > rows()) streams[column] = newStream();
			});

			// A few letters within the streams change: the restless "live data" flicker.
			for (let i = 0; i < FLICKER; i++) {
				const column = Math.floor(Math.random() * streams.length);
				const stream = streams[column];
				if (!stream) continue;
				const row = Math.floor(stream.row) - 1 - Math.floor(Math.random() * (stream.length - 1));
				if (row >= 0) cell(column, row, TRAIL);
			}
		}

		frame = requestAnimationFrame(step);
		const observer = new ResizeObserver(resize);
		observer.observe(element);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="pointer-events-none block w-full"
	style:height="{height}px"
	style:-webkit-mask-image="linear-gradient(to bottom, black 55%, transparent)"
	style:mask-image="linear-gradient(to bottom, black 55%, transparent)"
	aria-hidden="true"
></canvas>
