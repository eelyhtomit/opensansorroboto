<script lang="ts">
	import { type Snippet } from 'svelte';
	import { setupI18n } from '$lib/i18n';
	import { isLoading } from 'svelte-i18n';

	interface Props { children: Snippet; }
	let { children }: Props = $props();

	setupI18n();
</script>

{#if !$isLoading}
	{@render children()}
{/if}

<style>
	/* App-wide globals — must live in the root layout so EVERY route (home and
	   the shareable /play/[token] pages) gets the base font and resets, not just
	   the home page. Theme color variables are provided by app.html. */
	:global(*, *::before, *::after) { box-sizing: border-box; }

	:global(body) {
		margin: 0;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 16px;
		color: var(--fg);
		background: var(--bg);
		-webkit-font-smoothing: antialiased;
		text-align: center;
		transition: background 0.2s, color 0.2s;
	}

	:global(button) { border-radius: 0 !important; font-family: inherit; color: var(--fg); }
	:global(input)  { border-radius: 0 !important; font-family: inherit; background: var(--bg); color: var(--fg); }
</style>
