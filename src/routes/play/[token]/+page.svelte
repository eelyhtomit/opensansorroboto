 <script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { game, score } from '$lib/stores/gameStore';
	import { theme } from '$lib/stores/themeStore';
	import { locale, t } from 'svelte-i18n';
	import { FONTS, type FontConfig } from '$lib/data/fonts';
	import { generateCustomQuestions } from '$lib/utils/generateQuestions';
	import Countdown from '$lib/components/Countdown.svelte';
	import GameScreen from '$lib/components/GameScreen.svelte';
	import AnswerButtons from '$lib/components/AnswerButtons.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import ResultScreen from '$lib/components/ResultScreen.svelte';
	import CustomLeaderboard from '$lib/components/CustomLeaderboard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const locales = [
		{ code: 'en', label: 'English' },
		{ code: 'es', label: 'Español' },
		{ code: 'fr', label: 'Français' },
		{ code: 'pt', label: 'Português' },
		{ code: 'zh', label: '中文' },
		{ code: 'ja', label: '日本語' },
		{ code: 'ko', label: '한국어' }
	];

	function currentLocale(value: string | null | undefined): string {
		return locales.find((l) => value === l.code || value?.startsWith(l.code))?.code ?? 'en';
	}

	let startError = $state('');
	let starting = $state(false);

	// Resolve stored font names → FontConfig objects (canonical from FONTS).
	function resolveFonts(names: string[]): FontConfig[] {
		return names
			.map((name) => FONTS.find((f) => f.name === name))
			.filter((f): f is FontConfig => Boolean(f));
	}

	// Font names for the landing header ("Guess between: …").
	const fontNames = $derived(data.game ? data.game.fonts : []);

	// Document title: a shared challenge gets its own title naming the fonts in
	// play; a missing game falls back to the generic site title.
	const pageTitle = $derived(
		data.game
			? $t('custom_share.page_title', { values: { fonts: fontNames.join(', ') } })
			: $t('title')
	);

	async function startGame() {
		if (!data.game) return;
		starting = true;
		startError = '';
		try {
			const pool = resolveFonts(data.game.fonts);
			const { questions, fontPool } = await generateCustomQuestions(pool);
			game.startGameWithDifficulty(
				questions,
				'custom',
				fontPool,
				data.game.token,
				data.game.creatorName
			);
		} catch (e: unknown) {
			startError = e instanceof Error ? e.message : 'Failed to start game.';
		} finally {
			starting = false;
		}
	}

	onMount(() => {
		// Show a landing page first (settings + leaderboard). Hydrate the store
		// so the per-token leaderboard can render, but DON'T auto-start — the
		// player taps "Play this game" to begin.
		if (data.game) {
			game.hydrateCustomGame(
				resolveFonts(data.game.fonts),
				data.game.token,
				data.game.creatorName
			);
		} else {
			game.reset();
		}
	});

	// True before any run has started — i.e. the landing page should be shown.
	const onLanding = $derived(
		$game.phase !== 'countdown' &&
			$game.phase !== 'playing' &&
			$game.phase !== 'result' &&
			$game.phase !== 'leaderboard'
	);

	// Pre-game view: the landing (settings + play CTA) or a dedicated full-screen
	// leaderboard. Switching is local UI state; the game phases take over once a
	// run actually starts.
	let preGameView = $state<'landing' | 'leaderboard'>('landing');

	// Leave to the main menu with a clean store so the home route doesn't reopen
	// on a stale phase (e.g. leaderboard) carried over from this game.
	async function backToMenu() {
		game.reset();
		await goto('/');
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<main class="app">
	<div class="container">
		{#if !data.game}
			<div class="not-found">
				<h1 class="nf-title">{$t('custom_share.not_found_title')}</h1>
				<p class="nf-body">{$t('custom_share.not_found_body')}</p>
				<button class="nf-link" onclick={backToMenu}>{$t('custom_share.create_your_own')}</button>
			</div>

		{:else if onLanding && preGameView === 'leaderboard'}
			<div class="leaderboard-screen">
				<CustomLeaderboard onBack={() => (preGameView = 'landing')} />
			</div>

		{:else if onLanding}
			<div class="landing">
				<div class="landing-header">
					<h1 class="landing-title">{$t('custom_share.landing_title')}</h1>
					{#if data.game.creatorName}
						<p class="landing-creator">
							{$t('custom_leaderboard.by', { values: { name: data.game.creatorName } })}
						</p>
					{/if}
					<p class="landing-fonts">
						{$t('custom_leaderboard.guess_between', { values: { fonts: fontNames.join(', ') } })}
					</p>
				</div>

				<div class="cta-group">
					<button class="play-cta" onclick={startGame} disabled={starting}>
						{starting ? $t('custom.starting') : $t('custom_leaderboard.play_this_game')}
					</button>

					{#if startError}
						<p class="nf-body error">{startError}</p>
					{/if}

					<button class="lb-toggle" onclick={() => (preGameView = 'leaderboard')}>
						{$t('leaderboard.title')}
					</button>
				</div>

				<button class="back-link" onclick={backToMenu}>{$t('leaderboard.back_to_menu')}</button>
			</div>

		{:else if $game.phase === 'countdown'}
			<Countdown />

		{:else if $game.phase === 'playing'}
			<div class="playing-layout">
				<GameScreen />
				<AnswerButtons />
				<div class="bottom-bar">
					<Timer />
					<span class="progress">{$game.currentIndex + 1} / {$game.questions.length}</span>
				</div>
				<button class="back-link" onclick={backToMenu}>{$t('custom_share.exit')}</button>
			</div>

		{:else if $game.phase === 'result'}
			<ResultScreen />

		{:else if $game.phase === 'leaderboard'}
			<CustomLeaderboard />
		{/if}

		{#if $game.phase !== 'countdown'}
		<div class="footer">
			<div class="locale-switcher">
				<select
					class="locale-select"
					value={currentLocale($locale)}
					onchange={(e) => locale.set((e.target as HTMLSelectElement).value)}
				>
					{#each locales as loc}
						<option value={loc.code}>{loc.label}</option>
					{/each}
				</select>
			</div>
			<button
				class="theme-toggle"
				onclick={() => theme.toggle()}
				aria-label="Toggle dark mode"
			>
				{$theme === 'dark' ? $t('theme.light') : $t('theme.dark')}
			</button>
		</div>
		{/if}
	</div>
</main>

<style>
	.app {
		min-height: 100svh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 2rem 1rem 3rem;
		position: relative;
		z-index: 1;
	}

	@media (max-width: 640px) {
		.app {
			padding: 0.5rem 0.5rem 2rem;
		}

		.playing-layout {
			padding-bottom: 160px;
		}
	}

	.container { width: 100%; max-width: 540px; display: flex; flex-direction: column; gap: 0; position: relative; z-index: 1; }

	/* Landing page (shown before the game starts) */
	.landing {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		padding: 2rem 0 1rem;
		width: 100%;
	}

	.landing-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		text-align: center;
	}

	.landing-title {
		font-size: 1.75rem;
		font-weight: 500;
		letter-spacing: -0.03em;
		margin: 0;
		color: var(--fg);
	}

	.landing-creator {
		font-size: 0.9rem;
		color: var(--fg-muted);
		margin: 0;
	}

	.landing-fonts {
		font-size: 0.95rem;
		color: var(--fg);
		margin: 0.2rem 0 0;
		max-width: 420px;
		line-height: 1.4;
	}

	.cta-group {
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.play-cta,
	.lb-toggle {
		width: 100%;
		min-height: 3.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		cursor: pointer;
	}

	.play-cta {
		border: 1px solid var(--fg);
		background: var(--fg);
		color: var(--bg);
		font-size: 1rem;
		font-weight: 500;
		transition: opacity 0.1s;
	}
	.play-cta:hover:not(:disabled) { opacity: 0.85; }
	.play-cta:disabled { opacity: 0.4; cursor: default; }

	.lb-toggle {
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--fg);
		font-size: 0.9rem;
		transition: background 0.1s;
	}
	.lb-toggle:hover { background: var(--surface-hover); }

	/* Dedicated full-screen leaderboard shown over the landing page. */
	.leaderboard-screen {
		width: 100%;
		padding-top: 1rem;
	}

	.error { color: var(--fg); }

	.playing-layout { display: flex; flex-direction: column; gap: 2rem; }

	.bottom-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding-top: 0.5rem;
	}

	.progress {
		font-size: 0.8rem;
		color: var(--fg-subtle);
		letter-spacing: 0.05em;
		font-variant-numeric: tabular-nums;
	}

	.back-link {
		background: none;
		border: none;
		font-size: 0.8rem;
		color: var(--fg-subtle);
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 2px;
		text-align: center;
	}
	.back-link:hover { color: var(--fg-muted); }

	.not-found {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 5rem 2rem;
		text-align: center;
	}

	.nf-title {
		font-size: 1.75rem;
		font-weight: 500;
		letter-spacing: -0.03em;
		margin: 0;
		color: var(--fg);
	}

	.nf-body {
		color: var(--fg-muted);
		margin: 0;
		font-size: 0.95rem;
		max-width: 340px;
		line-height: 1.5;
	}

	.nf-link {
		margin-top: 0.5rem;
		padding: 0.8rem 1.5rem;
		border: 1px solid var(--fg);
		background: var(--fg);
		color: var(--bg);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
	}
	.nf-link:hover { opacity: 0.85; }

	.footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin-top: 3rem;
	}

	.locale-switcher { display: flex; align-items: center; }

	.locale-select {
		background: none;
		border: 1px solid var(--border);
		font-size: 0.75rem;
		color: var(--fg-subtle);
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		transition: color 0.1s, border-color 0.1s;
		appearance: none;
		-webkit-appearance: none;
		padding-right: 1.5rem;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='none' stroke='%23999' stroke-width='1.5' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.4rem center;
	}

	.locale-select:hover,
	.locale-select:focus {
		color: var(--fg);
		border-color: var(--fg-muted);
		outline: none;
	}

	.theme-toggle {
		background: none;
		border: none;
		font-size: 0.75rem;
		color: var(--fg-subtle);
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.theme-toggle:hover { color: var(--fg-muted); }
</style>
