<script lang="ts">
	import './layout.css';
	import { APP } from '#lib/config.js';
	import UpdateNotice from '#lib/UpdateNotice.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{APP.name}</title>
	<meta name="description" content={APP.description} />
	<meta name="theme-color" content={APP.themeColor} />
</svelte:head>

{@render children()}

<UpdateNotice />
