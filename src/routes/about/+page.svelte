<script lang="ts">
	import { APP } from '#lib/config.js';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>About & privacy · {APP.name}</title>
	<meta
		name="description"
		content="About {APP.name}, how to install it, and how it handles privacy."
	/>
</svelte:head>

<main class="mx-auto max-w-prose px-4 py-6 text-slate-200">
	<p><a class="text-gold" href={resolve('/')}>← Back to the game</a></p>

	<h1 class="mt-4 font-arcade text-2xl text-gold uppercase">About</h1>

	<p class="mt-3">
		{APP.name} is an educational falling-blocks game about mRNA, codons and amino acids. Cleared rows
		are read like a strand of mRNA: form a start codon to begin a chain of amino acids, and a stop codon
		to bank it.
	</p>
	<p class="mt-3">
		It plays on phones, tablets and computers: with gestures on touch screens, and the keyboard on
		computers. Once it has loaded, it also works <strong>offline</strong>. High scores need an
		internet connection.
	</p>

	<h2 class="mt-6 font-arcade text-base text-gold uppercase">Install it</h2>
	<ul class="mt-2 list-disc space-y-1 pl-5">
		<li><strong>iPhone and iPad (Safari):</strong> tap Share, then <em>Add to Home Screen</em>.</li>
		<li><strong>Android (Chrome):</strong> open the ⋮ menu, then <em>Install app</em>.</li>
		<li>
			<strong>Computer (Chrome or Edge):</strong> click the install icon at the right of the address bar.
		</li>
		<li><strong>Mac (Safari):</strong> choose File, then <em>Add to Dock</em>.</li>
	</ul>

	<h2 class="mt-6 font-arcade text-base text-gold uppercase">Who made it</h2>
	<p class="mt-2">
		Made by
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external link -->
		<a class="underline" href={APP.authorUrl} target="_blank" rel="noopener noreferrer"
			>{APP.author}<span class="sr-only"> (opens in a new tab)</span></a
		>. The
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external link -->
		<a class="underline" href={APP.sourceUrl} target="_blank" rel="noopener noreferrer"
			>source code<span class="sr-only"> (opens in a new tab)</span></a
		>
		is open, under the AGPL-3.0 licence. {APP.name} is not affiliated with or endorsed by Tetris or The
		Tetris Company.
	</p>

	<h1 id="privacy" class="mt-8 font-arcade text-2xl text-gold uppercase">Privacy</h1>
	<p class="mt-3">
		{APP.name} has no accounts, no cookies, no advertising, and no tracking across other websites.
	</p>

	<h2 class="mt-6 font-arcade text-base text-gold uppercase">Your settings</h2>
	<p class="mt-2">
		Your choices for sound, music and tips, and the initials you last used, are kept in your own
		browser's storage. They are never sent to us. Clearing this site's data in your browser removes
		them.
	</p>

	<h2 class="mt-6 font-arcade text-base text-gold uppercase">High scores</h2>
	<p class="mt-2">
		Only if you choose to save a score, we store: the initials you enter, your score, level, rows
		and chains, your longest chain, how long the game lasted, whether tips were used, the version of
		the game's rules, and when it was saved. The high-score table shows the initials, level and
		score publicly. We do not store IP addresses or any other information about you.
	</p>

	<h2 class="mt-6 font-arcade text-base text-gold uppercase">Checking you're human</h2>
	<p class="mt-2">
		When you save a score, Cloudflare Turnstile checks that you are a person, not an automated
		program. It works in the background, and processes some technical information from your browser
		to do so. See Cloudflare's
		<a
			class="underline"
			href="https://www.cloudflare.com/turnstile-privacy-policy/"
			target="_blank"
			rel="noopener noreferrer"
			>Turnstile Privacy Addendum<span class="sr-only"> (opens in a new tab)</span></a
		>.
	</p>

	<h2 class="mt-6 font-arcade text-base text-gold uppercase">Visits and errors</h2>
	<p class="mt-2">
		We count visits with Cloudflare Web Analytics, which uses no cookies and only shows us
		aggregated totals, such as how many people visited. If something goes wrong in the game, an
		error report is sent to Sentry (stored in the EU), so we can fix it. Reports describe the error
		and the type of browser and device, and are set up not to store IP addresses.
	</p>

	<h2 class="mt-6 font-arcade text-base text-gold uppercase">Your rights</h2>
	<p class="mt-2">
		{APP.name} is run by {APP.author} in the UK. Under UK data protection law, you can ask what we hold
		about you, or ask us to remove it. As we don't store information that identifies you, we usually can't
		link a score to a person, but we can remove a score if you tell us its initials, score and roughly
		when it was saved. Contact:
		<a class="underline" href="mailto:{APP.contactEmail}">{APP.contactEmail}</a>.
	</p>

	<p class="mt-6 text-sm opacity-70">Last updated: 17 October 2026.</p>
</main>
