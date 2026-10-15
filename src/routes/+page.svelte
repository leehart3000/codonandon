<script lang="ts">
	import Game from '#lib/components/Game.svelte';
	import { APP } from '#lib/config.js';
</script>

<!-- On small screens the heading is visually hidden (still read by screen readers), to give the board room. -->
<header class="sr-only sm:not-sr-only">
	<h1>{APP.name}</h1>
	<p>{APP.description}</p>
</header>

<Game />
