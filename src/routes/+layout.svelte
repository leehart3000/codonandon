<script lang="ts">
	import './layout.css';
	import { APP } from '#lib/config.js';
	import UpdateNotice from '#lib/UpdateNotice.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<!-- Each page sets its own title and description. -->
<svelte:head>
	<meta name="theme-color" content={APP.themeColor} />
</svelte:head>

<UpdateNotice />

{@render children()}
