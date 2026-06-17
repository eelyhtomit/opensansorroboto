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
