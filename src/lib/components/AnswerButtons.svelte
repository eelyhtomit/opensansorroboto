<script lang="ts">
	import { game } from '$lib/stores/gameStore';
	import { DIFFICULTY_FONTS } from '$lib/data/fonts';

	const fonts = $derived(DIFFICULTY_FONTS[$game.difficulty]);
	const question = $derived($game.questions[$game.currentIndex]);
	const answered = $derived(question?.answered ?? false);
	const correctFont = $derived(question?.font.name);

	function answer(fontName: string) {
		if (answered) return;
		game.answerQuestion(fontName);
	}

	function btnClass(fontName: string): string {
		if (!answered) return 'answer-btn';
		if (fontName === correctFont) return 'answer-btn correct';
		if (fontName === question?.userAnswer) return 'answer-btn wrong';
		return 'answer-btn dimmed';
	}
</script>

<div class="answer-grid" style="--cols: {Math.min(fonts.length, 4)}">
	{#each fonts as font}
		<button
			class={btnClass(font.name)}
			disabled={answered}
			onclick={() => answer(font.name)}
		>
			{font.name}
		</button>
	{/each}
</div>

<style>
	.answer-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols, 2), 1fr);
		gap: 0.5rem;
		width: 100%;
	}

	@media (max-width: 380px) {
		.answer-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.answer-btn {
		padding: 0.8rem 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg);
		font-size: 0.85rem;
		color: var(--fg);
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-height: 44px;
	}

	.answer-btn:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: var(--fg-muted);
	}

	.answer-btn:disabled { cursor: default; }

	.answer-btn.correct {
		background: var(--fg);
		border-color: var(--fg);
		color: var(--bg);
		font-weight: 500;
	}

	.answer-btn.wrong {
		background: var(--bg);
		border-color: var(--fg);
		color: var(--fg);
		text-decoration: line-through;
	}

	.answer-btn.dimmed { opacity: 0.25; }
</style>
