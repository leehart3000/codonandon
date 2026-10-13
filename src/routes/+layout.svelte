<script lang="ts">
	import './layout.css';
	import { APP } from '#lib/config.js';
	import type { LayoutProps } from './$types';
	import UpdateNotice from '#lib/UpdateNotice.svelte';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{APP.name}</title>
	<meta name="description" content={APP.description} />
	<meta name="theme-color" content={APP.themeColor} />
</svelte:head>

{@render children()}

<footer>
	<a href={APP.sourceUrl} target="_blank" rel="noopener noreferrer">
		Source code <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span>
	</a>
	(AGPL-3.0-only)
</footer>
<UpdateNotice />
