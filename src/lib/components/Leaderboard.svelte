<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { game } from '$lib/stores/gameStore';
	import { supabase, type LeaderboardEntry } from '$lib/supabase';
	import { type Difficulty } from '$lib/data/fonts';
	import { t } from 'svelte-i18n';

	const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'diabolical'];
	// Custom mode has no public leaderboard tab, so fall back to a real one.
	const initialTab: Difficulty = difficulties.includes($game.difficulty)
		? $game.difficulty
		: 'easy';
	let activeTab = $state<Difficulty>(initialTab);
	let entries = $state<LeaderboardEntry[]>([]);
	let loading = $state(true);
	let error = $state('');
	let copied = $state(false);

	// The exact leaderboard row id of the LAST game the player finished
	// (returned by /api/submit-score). This uniquely identifies their row.
	const highlightId = $game.highlightId ?? null;

	// Index of the row for the player's most recent game ( -1 if it isn't on the
	// visible board — e.g. a slower replay that ranks below the cutoff ). We match
	// strictly by id so we never highlight an older/faster entry with the same
	// name, and exactly one row is ever highlighted.
	const myIndex = $derived(
		highlightId === null ? -1 : entries.findIndex((e) => e.id === highlightId)
	);

	const LEADERBOARD_LIMIT: Partial<Record<Difficulty, number>> = { easy: 50, medium: 50, hard: 20, diabolical: 20 };

	// Public site URL shared across all platforms.
	const SHARE_URL = 'https://opensansorroboto.com/';

	// Compose the brag message from the player's finish time. We fetch the raw
	// template and substitute manually rather than relying on svelte-i18n's ICU
	// interpolation, which silently leaves placeholders intact when a message
	// contains ICU-special characters (e.g. apostrophes).
	function shareMessage(entry: LeaderboardEntry): string {
		return (
			$t('share.text')
				.replaceAll('{time}', formatTime(entry.time_ms))
				// A leaderboard entry is always a perfect run.
				.replaceAll('{score}', '10/10')
				// Defensive: drop any other unfilled {placeholder} tokens (e.g. a
				// legacy {difficulty}) so nothing raw ever leaks into the message.
				.replace(/\{[^}]*\}/g, '')
				.replace(/\s{2,}/g, ' ')
				.trim()
		);
	}

	// Facebook scrapes the page's Open Graph tags and builds the card from the URL
	// alone, so we only need to hand it the link.
	function shareOnFacebook() {
		const url =
			'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SHARE_URL);
		window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
	}

	// X needs tweet text but still unfurls the URL into a Twitter Card below it.
	function shareOnX(entry: LeaderboardEntry) {
		const url =
			'https://twitter.com/intent/tweet?text=' +
			encodeURIComponent(shareMessage(entry)) +
			'&url=' +
			encodeURIComponent(SHARE_URL);
		window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
	}

	// Copy the brag message together with the link so it can be pasted anywhere.
	async function copyLink(entry: LeaderboardEntry) {
		const payload = `${shareMessage(entry)} ${SHARE_URL}`;
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

	async function fetchLeaderboard(diff: Difficulty) {
		loading = true; error = '';
		const { data, error: err } = await supabase
			.from('leaderboard').select('*').eq('difficulty', diff)
			.order('time_ms', { ascending: true }).limit(LEADERBOARD_LIMIT[diff] ?? 50);
		loading = false;
		if (err) { error = $t('leaderboard.error'); entries = []; }
		else {
			entries = data as LeaderboardEntry[];
			// Scroll the player's own (highlighted) row into view after render
			if (highlightId) {
				await tick();
				document.querySelector('.entry.highlighted')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	}

	function setTab(diff: Difficulty) { activeTab = diff; fetchLeaderboard(diff); }

	function formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const cents = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
		return `${s}.${cents}s`;
	}

	function drawKofi() {
		(window as any).kofiWidgetOverlay?.draw('yhtomit', {
			'type': 'floating-chat',
			'floating-chat.donateButton.text': 'Buy me a decaf',
			'floating-chat.donateButton.background-color': '#ffffff',
			'floating-chat.donateButton.text-color': '#323842'
		});
	}

	function removeKofi() {
		document.getElementById('kofi-overlay-btn')?.remove();
		document.querySelector('.kofi-button-container')?.remove();
		document.querySelectorAll('[id^="kofi"]').forEach((el) => el.remove());
	}

	onMount(() => {
		fetchLeaderboard(activeTab);

		// If already loaded (revisiting leaderboard), just re-draw
		if ((window as any).kofiWidgetOverlay) {
			drawKofi();
		} else {
			const existing = document.querySelector('script[src*="overlay-widget.js"]');
			if (!existing) {
				const script = document.createElement('script');
				script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
				script.onload = drawKofi;
				document.body.appendChild(script);
			} else {
				// Script tag exists but may still be loading
				existing.addEventListener('load', drawKofi);
			}
		}

		return () => {
			removeKofi();
		};
	});
</script>

<div class="leaderboard">
	<div class="lb-header">
		<button class="back-btn" onclick={() => game.goTo('difficulty')}>{$t('leaderboard.back')}</button>
		<h2 class="lb-title">{$t('leaderboard.title')}</h2>
	</div>

	<div class="tabs">
		{#each difficulties as diff}
			<button class="tab" class:active={activeTab === diff} onclick={() => setTab(diff)}>
				{$t(`difficulty_short.${diff}`)}
			</button>
		{/each}
	</div>

	{#if loading}
		<p class="state-msg">{$t('leaderboard.loading')}</p>
	{:else if error}
		<p class="state-msg">{error}</p>
	{:else if entries.length === 0}
		<p class="state-msg">{$t('leaderboard.empty')}</p>
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
								<button class="share-btn facebook" onclick={shareOnFacebook} aria-label={$t('share.facebook')} title={$t('share.facebook')}>
									<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
										<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
									</svg>
								</button>
								<button class="share-btn x" onclick={() => shareOnX(entry)} aria-label={$t('share.x')} title={$t('share.x')}>
									<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
										<path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3L17.61 20.65Z" />
									</svg>
								</button>
								<button class="share-btn copy" onclick={() => copyLink(entry)} aria-label={$t('share.copy')} title={copied ? $t('share.copied') : $t('share.copy')}>
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

</div>

<style>
	.leaderboard { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }

	.lb-header { display: flex; align-items: center; justify-content: center; gap: 1rem; }
	.back-btn { background: none; border: none; font-size: 0.85rem; color: var(--fg-muted); cursor: pointer; padding: 0; }
	.back-btn:hover { color: var(--fg); }
	.lb-title { font-size: 1.1rem; font-weight: 500; margin: 0; color: var(--fg); }

	.tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.25rem; border-bottom: 1px solid var(--border); }

	.tab {
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		font-size: 0.82rem;
		color: var(--fg-muted);
		cursor: pointer;
		margin-bottom: -1px;
		white-space: nowrap;
		transition: color 0.1s;
	}
	.tab.active { color: var(--fg); border-bottom-color: var(--fg); }
	.tab:hover:not(.active) { color: var(--fg); }

	.state-msg { font-size: 0.85rem; color: var(--fg-subtle); text-align: center; padding: 2rem 0; margin: 0; }

	.entries { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }

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
		gap: 0.5rem;
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
	.entry-date { font-size: 0.75rem; color: var(--fg-subtle); }

	/* Share row — only shown inside the highlighted (current player) entry */
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

</style>
