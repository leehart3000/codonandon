<script lang="ts">
	import { onMount } from 'svelte';

	/** Falling genetic-code letters (A, U, G, C), in the style of film "code rain". Decoration only. */
	let { height = 64 }: { height?: number } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	const LETTERS = ['A', 'U', 'G', 'C'];
	/** Size of one letter's square, in pixels: narrow and tall, so columns read as streams. */
	const COLUMN = 11;
	const ROW = 13;
	/** Time between updates. Each column moves at its own speed within this. */
	const FRAME_MS = 99;
	/** The menu background: clears each square, and fades the trails. Higher fade = shorter trails. */
	const BACKGROUND = '#0f172a';
	const FADE = 'rgba(15, 23, 42, 0.1)';
	const TRAIL = '#7ec98f';
	const HEAD = '#ecfdf5';
	/** How many trail letters change each update, for the flicker. */
	const FLICKER = 999;

	const randomLetter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)] ?? 'A';
	/** Rows per update: slow columns step only now and then. */
	const randomSpeed = () => 0.3 + Math.random() * 0.7;

	onMount(() => {
		const element = canvas;
		const context = element?.getContext('2d');
		if (!element || !context) return;

		const scale = window.devicePixelRatio || 1;
		let width = 0;
		const rows = () => height / ROW;
		/** Each column's falling head: how far down it is (in rows), and how fast it falls. */
		let streams: { row: number; speed: number }[] = [];

		function resize() {
			if (!element || !context) return;
			width = element.clientWidth;
			element.width = Math.round(width * scale);
			element.height = Math.round(height * scale);
			context.setTransform(scale, 0, 0, scale, 0, 0);
			context.font = `${ROW - 2}px ui-monospace, monospace`;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			streams = Array.from({ length: Math.ceil(width / COLUMN) }, () => ({
				row: -Math.random() * rows() * 2,
				speed: randomSpeed()
			}));
		}

		/** Clear one square, then draw a single letter in it. */
		function cell(column: number, row: number, colour: string, glow = false) {
			if (!context) return;
			const x = column * COLUMN;
			const y = row * ROW;
			context.fillStyle = BACKGROUND;
			context.fillRect(x, y, COLUMN, ROW);
			context.shadowColor = TRAIL;
			context.shadowBlur = glow ? 8 : 0;
			context.fillStyle = colour;
			context.fillText(randomLetter(), x + COLUMN / 2, y + ROW / 2);
			context.shadowBlur = 0;
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

			// Fade everything a little, so trails dim gradually.
			context.fillStyle = FADE;
			context.fillRect(0, 0, width, height);

			streams.forEach((stream, column) => {
				const before = Math.floor(stream.row);
				stream.row += stream.speed;
				const after = Math.floor(stream.row);
				// When a column steps down: its old head becomes trail, and a new glowing head appears.
				if (after !== before) {
					cell(column, before, TRAIL);
					cell(column, after, HEAD, true);
				}
				// Off the bottom: start again above the top, at a new speed.
				if (stream.row > rows() + 6) {
					stream.row = -Math.random() * rows();
					stream.speed = randomSpeed();
				}
			});

			// A few letters in the trails change: the restless "live data" flicker.
			context.globalAlpha = 0.6;
			for (let i = 0; i < FLICKER; i++) {
				const column = Math.floor(Math.random() * streams.length);
				const head = Math.floor(streams[column]?.row ?? -1);
				const row = head - 1 - Math.floor(Math.random() * 5);
				if (row >= 0) cell(column, row, TRAIL);
			}
			context.globalAlpha = 1;
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
