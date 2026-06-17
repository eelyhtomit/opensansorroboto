<script lang="ts">
	import { onDestroy } from 'svelte';
	import { game } from '$lib/stores/gameStore';
	import { browser } from '$app/environment';

	const question = $derived($game.questions[$game.currentIndex]);

	// Apply forced theme per question for diabolical mode; restore on destroy
	let prevTheme: string | null = null;

	$effect(() => {
		if (!browser) return;
		if (question?.forcedTheme) {
			if (prevTheme === null) {
				prevTheme = document.documentElement.getAttribute('data-theme');
			}
			document.documentElement.setAttribute('data-theme', question.forcedTheme);
		} else if (prevTheme !== null) {
			document.documentElement.setAttribute('data-theme', prevTheme);
			prevTheme = null;
		}
	});

	onDestroy(() => {
		if (browser && prevTheme !== null) {
			document.documentElement.setAttribute('data-theme', prevTheme);
		}
	});
</script>

{#if question}
	<div class="game-screen">
		<div
			class="phrase-display"
			style="font-family: {question.font.family}; font-size: {question.fontSize}px; font-style: {question.fontStyle}; font-weight: {question.fontWeight}; text-transform: {question.textTransform}; letter-spacing: {question.letterSpacing};"
			aria-label="Text in an unknown font: {question.phrase}"
		>
			{question.phrase}
		</div>
	</div>
{/if}

<style>
	.game-screen {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.phrase-display {
		min-height: 120px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		line-height: 1.3;
		padding: 1rem 0;
		color: var(--fg);
		word-break: break-word;
	}
</style>
