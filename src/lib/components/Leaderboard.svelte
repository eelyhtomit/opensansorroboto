<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { game } from '$lib/stores/gameStore';
	import { supabase, type LeaderboardEntry } from '$lib/supabase';
	import { type Difficulty } from '$lib/data/fonts';
	import { t } from 'svelte-i18n';

	const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'diabolical'];
	let activeTab = $state<Difficulty>($game.difficulty ?? 'easy');
	let entries = $state<LeaderboardEntry[]>([]);
	let loading = $state(true);
	let error = $state('');

	// Name to highlight (set when navigating here from ResultScreen after submit)
	const highlightName = $game.highlightName ?? null;

	const LEADERBOARD_LIMIT: Record<Difficulty, number> = { easy: 50, medium: 50, hard: 20, diabolical: 20 };

	async function fetchLeaderboard(diff: Difficulty) {
		loading = true; error = '';
		const { data, error: err } = await supabase
			.from('leaderboard').select('*').eq('difficulty', diff)
			.order('time_ms', { ascending: true }).limit(LEADERBOARD_LIMIT[diff]);
		loading = false;
		if (err) { error = $t('leaderboard.error'); entries = []; }
		else {
			entries = data as LeaderboardEntry[];
			// Scroll highlighted row into view after render
			if (highlightName) {
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
				<li class="entry" class:highlighted={highlightName !== null && entry.name === highlightName}>
					<span class="rank">{i + 1}</span>
					<span class="entry-name">{entry.name}</span>
					<span class="entry-time">{formatTime(entry.time_ms)}</span>
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
		display: grid;
		grid-template-columns: 1.5rem 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.55rem 0.75rem;
		font-size: 0.875rem;
		background: var(--surface);
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

</style>
