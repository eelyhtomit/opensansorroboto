<script lang="ts">
	import { game, isPerfect, score } from '$lib/stores/gameStore';
	import { generateQuestions } from '$lib/utils/generateQuestions';
	import { t } from 'svelte-i18n';

	let name = $state('');
	let email = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let submitError = $state('');

	function formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const cents = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
		return `${s}.${cents}s`;
	}

	async function tryAgain() {
		const questions = await generateQuestions($game.difficulty);
		game.startGameWithDifficulty(questions, $game.difficulty);
	}

	async function submitScore() {
		if (!name.trim()) return;
		submitting = true;
		submitError = '';

		try {
			const res = await fetch('/api/submit-score', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					email: email.trim() || undefined,
					time_ms: $game.timerMs,
					difficulty: $game.difficulty
				})
			});

			if (!res.ok) throw new Error('server error');
			submitted = true;
		} catch {
			submitError = $t('result.save_error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="result-screen">
	{#if $isPerfect}
		<p class="perfect-label">{$t('result.perfect')}</p>
		<p class="time-label">{formatTime($game.timerMs)}</p>

		{#if !submitted}
			<div class="name-entry">
				<p class="enter-name-label">{$t('result.enter_name')}</p>
				<div class="name-row">
					<input
						type="text"
						placeholder={$t('result.name_placeholder')}
						maxlength="32"
						bind:value={name}
						onkeydown={(e) => e.key === 'Enter' && submitScore()}
					/>
					<button class="submit-btn" onclick={submitScore} disabled={submitting || !name.trim()}>
						{submitting ? $t('result.saving') : $t('result.save')}
					</button>
				</div>
				<div class="email-row">
					<input
						type="email"
						placeholder={$t('result.email_placeholder')}
						maxlength="254"
						bind:value={email}
						onkeydown={(e) => e.key === 'Enter' && submitScore()}
					/>
					<p class="email-hint">{$t('result.email_hint')}</p>
				</div>
				{#if submitError}<p class="error">{submitError}</p>{/if}
			</div>
		{:else}
			<p class="saved-msg">{$t('result.saved')}</p>
		{/if}
	{:else}
		<p class="sorry">
			{#if $score <= 2}
				{$t('result.score_20')}
			{:else if $score <= 4}
				{$t('result.score_40')}
			{:else if $score <= 6}
				{$t('result.score_60')}
			{:else if $score <= 8}
				{$t('result.score_80')}
			{:else}
				{$t('result.sorry')}
			{/if}
		</p>
	{/if}

	<div class="result-actions">
		<button class="action-btn primary" onclick={tryAgain}>{$t('result.try_again')}</button>
		<button class="action-btn" onclick={() => game.goTo('leaderboard')}>{$t('result.leaderboard')}</button>
		<button class="action-btn" onclick={() => game.goTo('home')}>{$t('result.change_difficulty')}</button>
	</div>
</div>

<style>
	.result-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.75rem;
		padding: 4rem 2rem;
		width: 100%;
	}

	.perfect-label { font-size: 1.5rem; font-weight: 500; margin: 0; color: var(--fg); }
	.time-label { font-size: 1rem; color: var(--fg-muted); font-variant-numeric: tabular-nums; margin: -1.25rem 0 0; }
	.sorry { font-size: 1rem; color: var(--fg); margin: 0; }

	.name-entry { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; width: 100%; max-width: 340px; }
	.enter-name-label { font-size: 0.85rem; color: var(--fg-muted); margin: 0; }

	.name-row { display: flex; gap: 0.5rem; width: 100%; }

	.email-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
	}

	.email-hint {
		font-size: 0.72rem;
		color: var(--fg-subtle);
		margin: 0;
		text-align: left;
	}

	input {
		flex: 1;
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border);
		font-size: 0.9rem;
		outline: none;
		background: var(--bg);
		color: var(--fg);
		box-sizing: border-box;
	}
	input:focus { border-color: var(--fg); }

	.submit-btn { padding: 0.6rem 1rem; background: var(--fg); color: var(--bg); border: none; font-size: 0.9rem; cursor: pointer; white-space: nowrap; }
	.submit-btn:disabled { opacity: 0.3; cursor: default; }
	.saved-msg { font-size: 0.9rem; color: var(--fg-muted); margin: 0; }
	.error { font-size: 0.8rem; color: var(--fg); margin: 0; }

	.result-actions { display: flex; flex-direction: column; gap: 0.6rem; width: 100%; max-width: 340px; }

	.action-btn {
		width: 100%;
		padding: 0.8rem 1rem;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--fg);
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.1s;
		text-align: center;
	}
	.action-btn:hover { background: var(--surface-hover); }
	.action-btn.primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
	.action-btn.primary:hover { opacity: 0.85; }
</style>
