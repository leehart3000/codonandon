<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { APP } from '#lib/config.js';
	import { animateFavicon } from '#lib/favicon.js';
	import UpdateNotice from '#lib/UpdateNotice.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Turn the logo in the browser tab, like a game piece.
	onMount(() => animateFavicon());
</script>

<!-- Each page sets its own title and description. -->
<svelte:head>
	<meta name="theme-color" content={APP.themeColor} />
</svelte:head>

<UpdateNotice />

{@render children()}
