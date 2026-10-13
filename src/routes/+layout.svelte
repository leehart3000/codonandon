<script lang="ts">
	import './layout.css';
	import { APP } from '#lib/config.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{APP.name}</title>
	<meta name="description" content={APP.description} />
	<meta name="theme-color" content={APP.themeColor} />
</svelte:head>

{@render children()}

<footer>
	<a href={APP.sourceUrl}>Source code</a> (AGPL-3.0-only)
</footer>
