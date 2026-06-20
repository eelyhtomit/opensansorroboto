<script lang="ts">
	import { game } from '$lib/stores/gameStore';
	import { DIFFICULTY_FONTS, DIFFICULTY_QUESTION_COUNT, DIFFICULTY_LABELS, type Difficulty } from '$lib/data/fonts';
	import { generateQuestions } from '$lib/utils/generateQuestions';
	import { t } from 'svelte-i18n';

	const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'diabolical'];

	const heroFonts = [
		{ name: 'Open Sans', family: "'Open Sans', sans-serif" },
		{ name: 'Roboto',    family: "'Roboto', sans-serif"    }
	];
	const hero = heroFonts[Math.floor(Math.random() * 2)];

	let loading = $state(false);
	let errorMsg = $state('');

	async function select(difficulty: Difficulty) {
		loading = true;
		errorMsg = '';
		try {
			game.setDifficulty(difficulty);
			const { questions, fontPool } = await generateQuestions(difficulty);
			game.startGameWithDifficulty(questions, difficulty, fontPool);
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Failed to start game.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="difficulty-selector">
	<div class="hero" style="font-family: {hero.family}">
		<h1 class="title">{$t('title')}</h1>
	</div>
	<p class="subtitle">{@html $t('subtitle')}</p>

	<div class="levels">
		{#each difficulties as diff}
			<button class="level-btn" disabled={loading} onclick={() => select(diff)}>
				<span class="level-name">{$t(`difficulty.${diff}`)}</span>
				<span class="level-meta">{$t(`meta.${diff}`)}</span>
			</button>
		{/each}
	</div>

	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

	<button class="leaderboard-link" onclick={() => game.goTo('leaderboard')}>
		{$t('view_leaderboard')}
	</button>

	<div class="levels">
		<button
			class="level-btn custom-btn"
			disabled={loading}
			onclick={() => game.goTo('custom_config')}
		>
			<span class="level-name">{$t('difficulty.custom')}</span>
			<span class="level-meta">{$t('meta.custom')}</span>
		</button>
	</div>
</div>

<style>
	.difficulty-selector {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		padding: 4rem 2rem;
	}

	@media (max-width: 640px) {
		.difficulty-selector {
			padding: 1.5rem 1rem;
		}
	}

	.hero { display: flex; flex-direction: column; align-items: center; }

	.title {
		font-size: 2rem;
		font-weight: 500;
		letter-spacing: -0.03em;
		margin: 0;
		color: var(--fg);
	}

	.subtitle { color: var(--fg-muted); margin: -1.5rem 0 0; font-size: 0.95rem; }

	.levels {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 420px;
	}

	.level-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		background: var(--bg);
		cursor: pointer;
		text-align: center;
		transition: background 0.15s, border-color 0.15s;
	}

	.level-btn:hover:not(:disabled) { background: var(--surface-hover); border-color: var(--fg-muted); }
	.level-btn:disabled { opacity: 0.4; cursor: wait; }

	.custom-btn { border-style: dashed; margin-top: 0.5rem; }

	.level-name { font-weight: 500; font-size: 0.95rem; color: var(--fg); }
	.level-meta { font-size: 0.75rem; color: var(--fg-muted); }
	.error { font-size: 0.82rem; color: var(--fg); text-align: center; }

	.leaderboard-link {
		background: none;
		border: none;
		color: var(--fg-subtle);
		font-size: 0.85rem;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}

	.leaderboard-link:hover { color: var(--fg); }
</style>
