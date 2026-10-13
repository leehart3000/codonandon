<script lang="ts">
	import Game from '#lib/components/Game.svelte';
	import { APP } from '#lib/config.js';
</script>

<h1>{APP.name}</h1>
<p>{APP.description}</p>

<Game />
