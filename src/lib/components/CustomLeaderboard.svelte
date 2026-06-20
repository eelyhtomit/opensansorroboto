<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { game } from '$lib/stores/gameStore';
	import { supabase, type CustomGameScore } from '$lib/supabase';
	import { generateCustomQuestions } from '$lib/utils/generateQuestions';
	import { t } from 'svelte-i18n';

	// When true, hide the in-component "Play this game" button (the landing page
	// provides its own primary play CTA, so we avoid showing two).
	// `onBack`, when provided, overrides the default "back to menu" behaviour of
	// the header back button — used when this leaderboard is shown as a separate
	// screen over the landing page, so back returns to the landing instead.
	let {
		hidePlay = false,
		onBack
	}: { hidePlay?: boolean; onBack?: () => void } = $props();

	// The token + creator come from the store (hydrated by the /play/[token] page).
	const token = $derived($game.shareToken);
	const creatorName = $derived($game.creatorName);
	// Names of the fonts in this game's pool, for the header line.
	const fontNames = $derived($game.fontPool.map((f) => f.name));

	// Exact id of the row the player just submitted (returned by the score API).
	const highlightId = $derived($game.highlightId);

	let entries = $state<CustomGameScore[]>([]);
	let loading = $state(true);
	let error = $state('');
	let copied = $state(false);
	let replaying = $state(false);

	const myIndex = $derived(
		highlightId === null ? -1 : entries.findIndex((e) => e.id === highlightId)
	);

	// Per-token game URL — sharing this lets others play the exact same game.
	function shareUrl(): string {
		if (!token) return '';
		const origin =
			typeof window !== 'undefined' ? window.location.origin : 'https://opensansorroboto.com';
		return `${origin}/play/${token}`;
	}

	// Compose the brag message from the player's finish time — mirrors the preset
	// leaderboard. We fetch the raw template and substitute manually rather than
	// relying on svelte-i18n's ICU interpolation, which silently leaves
	// placeholders intact when a message contains ICU-special characters.
	function shareMessage(entry: CustomGameScore): string {
		return (
			$t('share.text')
				.replaceAll('{time}', formatTime(entry.time_ms))
				// A custom leaderboard entry is always a perfect run.
				.replaceAll('{score}', '10/10')
				// Defensive: drop any other unfilled {placeholder} tokens.
				.replace(/\{[^}]*\}/g, '')
				.replace(/\s{2,}/g, ' ')
				.trim()
		);
	}

	// Facebook builds its card from the page's Open Graph tags, so it only needs
	// the link.
	function shareOnFacebook() {
		const url = shareUrl();
		if (!url) return;
		window.open(
			'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
			'_blank',
			'noopener,noreferrer,width=600,height=500'
		);
	}

	// X needs tweet text but still unfurls the URL into a Twitter Card below it.
	function shareOnX(entry: CustomGameScore) {
		const url = shareUrl();
		if (!url) return;
		window.open(
			'https://twitter.com/intent/tweet?text=' +
				encodeURIComponent(shareMessage(entry)) +
				'&url=' +
				encodeURIComponent(url),
			'_blank',
			'noopener,noreferrer,width=600,height=500'
		);
	}

	function formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const cents = Math.floor((ms % 1000) / 10)
			.toString()
			.padStart(2, '0');
		return `${s}.${cents}s`;
	}

	// Copy the brag message together with the game link so it can be pasted
	// anywhere — mirrors the preset leaderboard's copy behaviour.
	async function copyLink(entry: CustomGameScore) {
		const url = shareUrl();
		if (!url) return;
		const payload = `${shareMessage(entry)} ${url}`;
		try {
			await navigator.clipboard.writeText(payload);
		} catch {
			const ta = document.createElement('textarea');
			ta.value = payload;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function fetchScores() {
		if (!token) {
			loading = false;
			error = $t('custom_leaderboard.error');
			return;
		}
		loading = true;
		error = '';
		// Leaderboard entries are always perfect 10/10 runs, so rank by fastest
		// time alone.
		const { data, error: err } = await supabase
			.from('custom_game_scores')
			.select('*')
			.eq('token', token)
			.order('time_ms', { ascending: true })
			.limit(100);
		loading = false;
		if (err) {
			error = $t('custom_leaderboard.error');
			entries = [];
		} else {
			entries = data as CustomGameScore[];
			if (highlightId) {
				await tick();
				document
					.querySelector('.entry.highlighted')
					?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	}

	async function playThisGame() {
		replaying = true;
		try {
			// Replay the same shared game: regenerate questions from the same pool,
			// keep the token bound so scores land on this same leaderboard.
			const { questions, fontPool } = await generateCustomQuestions($game.fontPool);
			game.startGameWithDifficulty(questions, 'custom', fontPool, token, creatorName);
		} finally {
			replaying = false;
		}
	}

	// Return to the main menu. The home route renders from the persistent game
	// store, so reset it first or it would re-open on the leaderboard phase.
	async function backToMenu() {
		game.reset();
		await goto('/');
	}

	// Jump straight to the custom-game settings (font picker) rather than the
	// main menu. Reset clears the shared-game token/phase, then we switch the
	// store to the custom-config phase the home route renders on arrival.
	async function createYourOwn() {
		game.reset();
		game.goTo('custom_config');
		await goto('/');
	}

	onMount(() => {
		fetchScores();
	});
</script>

<div class="custom-leaderboard">
	<div class="lb-header">
		<button class="back-btn" onclick={onBack ?? backToMenu}>
			{onBack ? $t('leaderboard.back') : $t('leaderboard.back_to_menu')}
		</button>
		<h2 class="lb-title">{$t('custom_leaderboard.title')}</h2>
		{#if creatorName}
			<p class="lb-creator">{$t('custom_leaderboard.by', { values: { name: creatorName } })}</p>
		{/if}
		{#if fontNames.length}
			<p class="lb-fonts">
				{$t('custom_leaderboard.guess_between', { values: { fonts: fontNames.join(', ') } })}
			</p>
		{/if}
	</div>

	{#if loading}
		<p class="state-msg">{$t('leaderboard.loading')}</p>
	{:else if error}
		<p class="state-msg">{error}</p>
	{:else if entries.length === 0}
		<p class="state-msg">{$t('custom_leaderboard.empty')}</p>
	{:else}
		<ol class="entries">
			{#each entries as entry, i}
				{@const isMe = i === myIndex}
				<li class="entry" class:highlighted={isMe}>
					<div class="entry-row">
						<span class="rank">{i + 1}</span>
						<span class="entry-name">{entry.name}</span>
						<span class="entry-time">{formatTime(entry.time_ms)}</span>
					</div>

					{#if isMe}
						<div class="share">
							<span class="share-label">{$t('share.title')}</span>
							<div class="share-buttons">
								<button
									class="share-btn facebook"
									onclick={shareOnFacebook}
									aria-label={$t('share.facebook')}
									title={$t('share.facebook')}
								>
									<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
										<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
									</svg>
								</button>
								<button
									class="share-btn x"
									onclick={() => shareOnX(entry)}
									aria-label={$t('share.x')}
									title={$t('share.x')}
								>
									<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
										<path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3L17.61 20.65Z" />
									</svg>
								</button>
								<button
									class="share-btn copy"
									onclick={() => copyLink(entry)}
									aria-label={$t('custom_share.copy_link')}
									title={copied ? $t('share.copied') : $t('custom_share.copy_link')}
								>
									{#if copied}
										<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M20 6 9 17l-5-5" />
										</svg>
									{:else}
										<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
											<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
										</svg>
									{/if}
								</button>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if !hidePlay}
		<button class="play-btn" onclick={playThisGame} disabled={replaying}>
			{replaying ? $t('custom.starting') : $t('custom_leaderboard.play_this_game')}
		</button>
	{/if}

	<button class="create-own" onclick={createYourOwn}>{$t('custom_share.create_your_own')}</button>
</div>

<style>
	.custom-leaderboard {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
	}

	.lb-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		text-align: center;
	}

	.back-btn {
		align-self: flex-start;
		background: none;
		border: none;
		font-size: 0.85rem;
		color: var(--fg-muted);
		cursor: pointer;
		padding: 0;
		margin-bottom: 0.4rem;
		text-decoration: none;
	}
	.back-btn:hover { color: var(--fg); }

	.lb-title {
		font-size: 1.25rem;
		font-weight: 500;
		margin: 0;
		color: var(--fg);
	}

	.lb-creator {
		font-size: 0.85rem;
		color: var(--fg-muted);
		margin: 0;
	}

	.lb-fonts {
		font-size: 0.85rem;
		color: var(--fg-subtle);
		margin: 0;
		max-width: 420px;
		line-height: 1.4;
	}

	/* Per-row share block — only shown on the player's own (highlighted) row,
	   mirroring the preset leaderboard. Colours inherit from the highlight. */
	.share {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.55rem;
		padding-top: 0.55rem;
		padding-left: 2rem;
		border-top: 1px solid rgba(0, 0, 0, 0.12);
	}
	:global([data-theme="dark"]) .share { border-top-color: rgba(255, 255, 255, 0.15); }

	.share-label {
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.7;
		color: inherit;
		margin-right: auto;
	}

	.share-buttons { display: flex; gap: 0.4rem; }

	.share-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.85rem;
		height: 1.85rem;
		padding: 0;
		border: 1px solid currentColor;
		background: transparent;
		color: inherit;
		cursor: pointer;
		opacity: 0.85;
		transition: background 0.12s, color 0.12s, opacity 0.12s, border-color 0.12s;
	}
	.share-btn:hover { opacity: 1; }
	.share-btn.facebook:hover { background: #1877f2; border-color: #1877f2; color: #fff; }
	.share-btn.x:hover { background: #000; border-color: #000; color: #fff; }
	.share-btn.copy:hover { background: currentColor; }
	.share-btn.copy:hover svg { color: #fef08a; }
	:global([data-theme="dark"]) .share-btn.copy:hover svg { color: #854d0e; }

	.play-btn {
		width: 100%;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: 0.88rem;
		line-height: 1.2;
		cursor: pointer;
		border: 1px solid var(--fg);
		background: var(--fg);
		color: var(--bg);
		transition: opacity 0.1s;
		text-align: center;
	}
	.play-btn:hover:not(:disabled) { opacity: 0.85; }
	.play-btn:disabled { opacity: 0.3; cursor: default; }

	.state-msg {
		font-size: 0.85rem;
		color: var(--fg-subtle);
		text-align: center;
		padding: 2rem 0;
		margin: 0;
	}

	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.entry {
		display: flex;
		flex-direction: column;
		padding: 0.55rem 0.75rem;
		font-size: 0.875rem;
		background: var(--surface);
	}

	.entry-row {
		display: grid;
		grid-template-columns: 1.5rem 1fr auto;
		gap: 0.6rem;
		align-items: center;
	}

	.entry:nth-child(1) { border-left: 3px solid var(--fg); }
	.entry:nth-child(2) { border-left: 3px solid var(--fg-muted); }
	.entry:nth-child(3) { border-left: 3px solid var(--fg-subtle); }

	.entry.highlighted {
		background: #fef08a;
		color: #111;
	}
	:global([data-theme="dark"]) .entry.highlighted {
		background: #854d0e;
		color: #fef9c3;
	}
	.entry.highlighted .entry-name,
	.entry.highlighted .rank,
	.entry.highlighted .entry-time { color: inherit; }

	.rank { color: var(--fg-subtle); font-size: 0.75rem; text-align: right; }
	.entry:nth-child(1) .rank,
	.entry:nth-child(2) .rank,
	.entry:nth-child(3) .rank { color: var(--fg); font-weight: 600; }

	.entry-name { font-weight: 500; color: var(--fg); }
	.entry-time { font-variant-numeric: tabular-nums; font-size: 0.82rem; color: var(--fg-muted); }

	.create-own {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--fg-subtle);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-align: center;
		margin-top: 0.25rem;
	}
	.create-own:hover { color: var(--fg); }
</style>
