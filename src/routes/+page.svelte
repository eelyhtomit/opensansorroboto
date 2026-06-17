<script lang="ts">
	import { game, score } from '$lib/stores/gameStore';
	import { theme } from '$lib/stores/themeStore';
	import { locale, t } from 'svelte-i18n';
	import DifficultySelector from '$lib/components/DifficultySelector.svelte';
	import Countdown from '$lib/components/Countdown.svelte';
	import GameScreen from '$lib/components/GameScreen.svelte';
	import AnswerButtons from '$lib/components/AnswerButtons.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import ResultScreen from '$lib/components/ResultScreen.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';

	const locales = [
		{ code: 'en', label: 'English' },
		{ code: 'es', label: 'Español' },
		{ code: 'fr', label: 'Français' },
		{ code: 'ja', label: '日本語' },
		{ code: 'pt', label: 'Português' },
		{ code: 'zh', label: '中文' }
	];

	function currentLocale(value: string | null | undefined): string {
		return locales.find((l) => value === l.code || value?.startsWith(l.code))?.code ?? 'en';
	}

	function quitGame() {
		// Record the incomplete play before navigating away
		fetch('/api/track-play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				difficulty: $game.difficulty,
				score: $score,
				time_ms: $game.timerMs,
				completed: false
			})
		}).catch(() => {});
		game.goTo('difficulty');
	}
</script>

{#if $game.phase === 'home' || $game.phase === 'difficulty'}
<div class="bg-wrap bg-left" aria-hidden="true">
	<div class="marquee-track marquee-up">
		<span class="marquee-text">Open Sans or Roboto</span>
		<span class="marquee-text">Open Sans or Roboto</span>
		<span class="marquee-text">Open Sans or Roboto</span>
		<span class="marquee-text">Open Sans or Roboto</span>
	</div>
</div>
<div class="bg-wrap bg-right" aria-hidden="true">
	<div class="marquee-track marquee-down">
		<span class="marquee-text">Open Sans or Roboto</span>
		<span class="marquee-text">Open Sans or Roboto</span>
		<span class="marquee-text">Open Sans or Roboto</span>
		<span class="marquee-text">Open Sans or Roboto</span>
	</div>
</div>
{/if}

<main class="app">
	<div class="container">

		{#if $game.phase === 'home' || $game.phase === 'difficulty'}
			<DifficultySelector />

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
				<button class="back-link" onclick={quitGame}>{$t('game.back_to_menu')}</button>
			</div>

		{:else if $game.phase === 'result'}
			<ResultScreen />

		{:else if $game.phase === 'leaderboard'}
			<Leaderboard />
		{/if}

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
				disabled={$game.difficulty === 'diabolical' && ($game.phase === 'playing' || $game.phase === 'countdown')}
			>
				{$theme === 'dark' ? $t('theme.light') : $t('theme.dark')}
			</button>
		</div>

	</div>
</main>

<style>
	.bg-wrap {
		position: fixed;
		top: 0;
		height: 100vh;
		overflow: hidden;
		pointer-events: none;
		user-select: none;
		z-index: 0;
	}

	.bg-left  { left: 0; }
	.bg-right { right: 0; }

	.marquee-track {
		display: flex;
		flex-direction: column;
	}

	.marquee-text {
		display: block;
		writing-mode: vertical-lr;
		font-size: 14vh;
		font-weight: 700;
		line-height: 1.1;
		white-space: nowrap;
		color: rgba(0, 0, 0, 0.08);
		letter-spacing: -0.03em;
		/* In vertical-lr, inline = top/bottom, block = left/right */
		padding-inline: 0.1em;
	}

	.bg-left  .marquee-track { font-family: 'Open Sans', sans-serif; }
	.bg-right .marquee-track { font-family: 'Roboto', sans-serif; }

	:global([data-theme="dark"]) .marquee-text { color: rgba(255, 255, 255, 0.08); }

	@keyframes scroll-up {
		from { transform: translateY(0); }
		to   { transform: translateY(-50%); }
	}

	@keyframes scroll-down {
		from { transform: translateY(-50%); }
		to   { transform: translateY(0); }
	}

	.marquee-up   { animation: scroll-up   22s linear infinite; }
	.marquee-down { animation: scroll-down 22s linear infinite; }

	:global(*, *::before, *::after) { box-sizing: border-box; }

	:global(body) {
		margin: 0;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 16px;
		color: var(--fg);
		background: var(--bg);
		-webkit-font-smoothing: antialiased;
		text-align: center;
		transition: background 0.2s, color 0.2s;
	}

	:global(button) { border-radius: 0 !important; font-family: inherit; color: var(--fg); }
	:global(input)  { border-radius: 0 !important; font-family: inherit; background: var(--bg); color: var(--fg); }

	.app {
		min-height: 100svh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 2rem 1rem 3rem;
		position: relative;
		z-index: 1;
	}

	.container { width: 100%; max-width: 540px; display: flex; flex-direction: column; gap: 0; position: relative; z-index: 1; }

	.playing-layout { display: flex; flex-direction: column; gap: 2rem; }

	.bottom-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
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
	}
	.back-link:hover { color: var(--fg-muted); }

	.footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin-top: 3rem;
	}

	.locale-switcher {
		display: flex;
		align-items: center;
	}

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
