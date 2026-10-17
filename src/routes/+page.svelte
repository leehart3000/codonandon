<script lang="ts">
	import Game from '#lib/components/Game.svelte';
	import { APP } from '#lib/config.js';
</script>

<svelte:head>
	<title>{APP.name}</title>
	<meta name="description" content={APP.description} />
</svelte:head>

<!-- Visually hidden: the wordmark in the game's top bar replaces it. Still read by screen readers and search engines. -->
<header class="sr-only">
	<h1>{APP.name}</h1>
	<p>{APP.description}</p>
	<a href="/about">About and privacy</a>
</header>

<Game />
