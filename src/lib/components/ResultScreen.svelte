<script lang="ts">
	import { game, isPerfect, score } from '$lib/stores/gameStore';
	import { generateQuestions, generateCustomQuestions } from '$lib/utils/generateQuestions';
	import { goto } from '$app/navigation';
	import { t } from 'svelte-i18n';
	import { onMount } from 'svelte';

	// Reset the persistent game store and jump straight to the custom-game
	// settings (font picker). Reset clears any stale phase/token; switching to
	// the custom-config phase makes the home route open on settings on arrival.
	async function createYourOwn() {
		game.reset();
		game.goTo('custom_config');
		await goto('/');
	}

	// Custom mode is a practice playground — no leaderboard, no score tracking.
	const isCustom = $derived($game.difficulty === 'custom');
	// A *shared* custom game came from a /play/[token] link and DOES have a
	// per-token leaderboard. Local-only custom practice (no token) does not.
	const isShared = $derived(isCustom && $game.shareToken !== null);

	// Pre-fill from previous session
	let name = $state(localStorage.getItem('osrr_name') ?? '');
	let email = $state(localStorage.getItem('osrr_email') ?? '');
	let submitted = $state(false);
	let submitting = $state(false);
	let submitError = $state('');
	let notOnBoard = $state(false);
	let replaying = $state(false);

	// Shared-custom-game state
	let sharedSubmitting = $state(false);
	let sharedSubmitError = $state('');
	let sharedCopied = $state(false);

	function shareUrl(): string {
		const token = $game.shareToken;
		if (!token) return '';
		const origin =
			typeof window !== 'undefined' ? window.location.origin : 'https://opensansorroboto.com';
		return `${origin}/play/${token}`;
	}

	async function copyShareLink() {
		const url = shareUrl();
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
		} catch {
			const ta = document.createElement('textarea');
			ta.value = url;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
		sharedCopied = true;
		setTimeout(() => (sharedCopied = false), 2000);
	}

	async function submitSharedScore() {
		const token = $game.shareToken;
		if (!token || !name.trim()) return;
		sharedSubmitting = true;
		sharedSubmitError = '';
		try {
			const res = await fetch(`/api/custom-game/${token}/score`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					email: email.trim() || undefined,
					score: $score,
					time_ms: $game.timerMs
				})
			});
			if (!res.ok) throw new Error('server error');
			const data = await res.json();
			localStorage.setItem('osrr_name', name.trim());
			if (email.trim()) localStorage.setItem('osrr_email', email.trim());
			// Jump to this game's leaderboard with the player's row highlighted.
			game.goToLeaderboardHighlighting(name.trim(), data.id ?? null);
		} catch {
			sharedSubmitError = $t('result.save_error');
		} finally {
			sharedSubmitting = false;
		}
	}

	// ---- Leave-confirmation guard -------------------------------------------
	// True when the player aced the run but hasn't saved their name yet, so
	// leaving would forfeit their leaderboard spot.
	const unsavedPerfect = $derived($isPerfect && !isCustom && !submitted && !notOnBoard);

	let leaveDialog = $state<HTMLDialogElement | null>(null);
	// The navigation to run if the player confirms they want to leave.
	let pendingLeave: (() => void) | null = $state(null);

	// Route a leave action through the confirmation dialog when there's an
	// unsaved perfect score; otherwise just perform it.
	function guardedLeave(action: () => void) {
		if (unsavedPerfect) {
			pendingLeave = action;
			leaveDialog?.showModal();
		} else {
			action();
		}
	}

	function confirmLeave() {
		// Capture before close(): closing fires `onclose`, which clears pendingLeave.
		const action = pendingLeave;
		pendingLeave = null;
		leaveDialog?.close();
		action?.();
	}

	function cancelLeave() {
		pendingLeave = null;
		leaveDialog?.close();
	}

	// Warn on browser-level navigation (tab close / refresh) while unsaved.
	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (unsavedPerfect) {
			e.preventDefault();
			// Legacy requirement for the native prompt to appear in some browsers.
			e.returnValue = '';
		}
	}

	// Fire-and-forget: record every completed game play (skip for custom mode)
	onMount(() => {
		// Guard browser-level navigation away from an unsaved perfect score.
		window.addEventListener('beforeunload', handleBeforeUnload);

		if ($game.difficulty !== 'custom') {
			fetch('/api/track-play', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					difficulty: $game.difficulty,
					score: $score,
					time_ms: $game.timerMs
				})
			}).catch(() => {
				// non-critical — ignore failures silently
			});
		}

		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	function formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const cents = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
		return `${s}.${cents}s`;
	}

	async function tryAgain() {
		replaying = true;
		try {
			if (isCustom) {
				// Reuse the same font pool the player configured for this session.
				// For shared games, keep the token bound so a replay's score lands
				// on the same per-token leaderboard.
				const { questions, fontPool } = await generateCustomQuestions($game.fontPool);
				game.startGameWithDifficulty(
					questions,
					'custom',
					fontPool,
					$game.shareToken,
					$game.creatorName
				);
			} else {
				const { questions, fontPool } = await generateQuestions($game.difficulty);
				game.startGameWithDifficulty(questions, $game.difficulty, fontPool);
			}
		} finally {
			replaying = false;
		}
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
			const data = await res.json();
			// Persist for next session autofill
			localStorage.setItem('osrr_name', name.trim());
			if (email.trim()) localStorage.setItem('osrr_email', email.trim());
			if (data.onBoard) {
				// Navigate straight to leaderboard with this exact row highlighted
				game.goToLeaderboardHighlighting(name.trim(), data.id ?? null);
			} else {
				// Score saved but outside the leaderboard window
				submitted = true;
				notOnBoard = true;
			}
		} catch {
			submitError = $t('result.save_error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="result-screen">
	<p class="your-score-label">{$t('result.your_score')}</p>
	<p class="score-label">{$score}/{$game.questions.length}</p>

	{#if isShared}
		<p class="time-label">{formatTime($game.timerMs)}</p>

		{#if $game.creatorName}
			<p class="shared-creator">{$t('custom_share.challenge_from', { values: { name: $game.creatorName } })}</p>
		{/if}

		<!-- Only a flawless run earns a spot on this game's leaderboard. -->
		{#if $isPerfect}
			<p class="perfect-label">{$t('result.perfect')}</p>
			<div class="name-entry">
				<p class="enter-name-label">{$t('custom_share.enter_name')}</p>
				<div class="name-row">
					<input
						type="text"
						placeholder={$t('result.name_placeholder')}
						maxlength="32"
						bind:value={name}
						onkeydown={(e) => e.key === 'Enter' && submitSharedScore()}
					/>
					<button class="submit-btn" onclick={submitSharedScore} disabled={sharedSubmitting || !name.trim()}>
						{sharedSubmitting ? $t('result.saving') : $t('result.save')}
					</button>
				</div>
				<div class="email-row">
					<input
						type="email"
						placeholder={$t('result.email_placeholder')}
						maxlength="254"
						bind:value={email}
						onkeydown={(e) => e.key === 'Enter' && submitSharedScore()}
					/>
					<p class="email-hint">{$t('result.email_hint')}</p>
				</div>
				{#if sharedSubmitError}<p class="error">{sharedSubmitError}</p>{/if}
			</div>
		{/if}

		<div class="result-actions">
			<button class="action-btn primary" onclick={tryAgain} disabled={replaying}>
				{replaying ? $t('custom.starting') : $t('custom.play_again')}
			</button>
			<button class="action-btn" onclick={() => game.goTo('leaderboard')}>
				{$t('custom_leaderboard.view')}
			</button>
			<button class="action-btn" onclick={copyShareLink}>
				{sharedCopied ? $t('share.copied') : $t('custom_share.copy_link')}
			</button>
			<button class="action-btn" onclick={createYourOwn}>{$t('custom_share.create_your_own')}</button>
		</div>
	{:else if isCustom}
		<p class="time-label">{formatTime($game.timerMs)}</p>

		<div class="result-actions">
			<button class="action-btn primary" onclick={tryAgain} disabled={replaying}>
				{replaying ? $t('custom.starting') : $t('custom.play_again')}
			</button>
			<button class="action-btn" onclick={() => game.goTo('custom_config')}>
				{$t('custom.change_fonts')}
			</button>
			<button class="action-btn" onclick={() => game.goTo('home')}>
				{$t('result.change_difficulty')}
			</button>
		</div>
	{:else}
		{#if $isPerfect}
			<p class="perfect-label">{$t('result.perfect')}</p>
			<p class="time-label">{formatTime($game.timerMs)}</p>

			{#if notOnBoard}
				<p class="not-on-board">{$t('result.perfect_not_on_board')}</p>
			{:else if !submitted}
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
			<button class="action-btn primary" onclick={() => guardedLeave(tryAgain)} disabled={replaying}>{$t('result.try_again')}</button>
			<button class="action-btn" onclick={() => guardedLeave(() => game.goTo('leaderboard'))}>{$t('result.leaderboard')}</button>
			<button class="action-btn" onclick={() => guardedLeave(() => game.goTo('home'))}>{$t('result.change_difficulty')}</button>
		</div>
	{/if}
</div>

<!-- Confirmation shown when leaving an unsaved perfect score. -->
<dialog bind:this={leaveDialog} class="leave-dialog" onclose={cancelLeave}>
	<h3 class="leave-title">{$t('result.leave_title')}</h3>
	<p class="leave-body">{$t('result.leave_body')}</p>
	<div class="leave-actions">
		<button class="action-btn primary" onclick={cancelLeave}>{$t('result.leave_cancel')}</button>
		<button class="action-btn" onclick={confirmLeave}>{$t('result.leave_confirm')}</button>
	</div>
</dialog>

<style>
	.result-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.75rem;
		padding: 4rem 2rem;
		width: 100%;
	}

	@media (max-width: 640px) {
		.result-screen {
			padding: 1.5rem 1rem;
		}
	}

	.your-score-label { font-size: 0.8rem; color: var(--fg-muted); margin: 0; letter-spacing: 0.05em; text-transform: uppercase; }
	.score-label { font-size: 2.5rem; font-weight: 600; margin: 0; color: var(--fg); font-variant-numeric: tabular-nums; }
	.perfect-label { font-size: 1.5rem; font-weight: 500; margin: 0; color: var(--fg); }
	.time-label { font-size: 1rem; color: var(--fg-muted); font-variant-numeric: tabular-nums; margin: -1.25rem 0 0; }
	.sorry { font-size: 1rem; color: var(--fg); margin: 0; }
	.not-on-board { font-size: 0.9rem; color: var(--fg-muted); margin: 0; max-width: 340px; text-align: center; line-height: 1.5; }

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
	/* An <a> styled as an action button (e.g. "Create your own game"). */
	a.action-btn { display: block; text-decoration: none; box-sizing: border-box; }

	.shared-creator {
		font-size: 0.9rem;
		color: var(--fg-muted);
		margin: 0;
		max-width: 340px;
		text-align: center;
		line-height: 1.5;
	}

	/* Leave-confirmation dialog */
	.leave-dialog {
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--fg);
		padding: 1.75rem;
		max-width: 360px;
		width: calc(100% - 2rem);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
	}
	.leave-dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.leave-title {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 0.6rem;
		color: var(--fg);
	}
	.leave-body {
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--fg-muted);
		margin: 0 0 1.5rem;
	}
	.leave-actions {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
</style>
