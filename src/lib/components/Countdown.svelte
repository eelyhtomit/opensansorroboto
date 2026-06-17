<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/stores/gameStore';
	import { DIFFICULTY_LABELS } from '$lib/data/fonts';
	import { t } from 'svelte-i18n';

	let count = $state(5);

	// Pick a random phrase once per mount; $t is reactive so use $derived
	const notReadyLabel = $derived.by(() => {
		const options = $t('countdown.not_ready');
		return Array.isArray(options)
			? options[Math.floor(Math.random() * options.length)]
			: options;
	});

	onMount(() => {
		const interval = setInterval(() => {
			count -= 1;
			if (count <= 0) { clearInterval(interval); game.beginPlaying(); }
		}, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="countdown">
	<p class="label">{$t(`difficulty_short.${$game.difficulty}`)}</p>
	<div class="number" class:pulse={count > 0}>{count > 0 ? count : 'Go'}</div>
	<p class="sub">{$t('countdown.sub')}</p>
	<button class="not-ready" onclick={() => game.goTo('difficulty')}>{notReadyLabel}</button>
</div>

<style>
	.countdown {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 60vh;
	}

	.label { font-size: 0.8rem; color: var(--fg-subtle); letter-spacing: 0.1em; text-transform: uppercase; margin: 0; }

	.number {
		font-size: 7rem;
		font-weight: 300;
		line-height: 1;
		color: var(--fg);
		width: 1.2ch;
		text-align: center;
	}

	.number.pulse { animation: pop 1s ease-out infinite; }

	@keyframes pop {
		0%   { transform: scale(1.15); opacity: 0.6; }
		30%  { transform: scale(1);    opacity: 1; }
		100% { transform: scale(1);    opacity: 1; }
	}

	.sub { font-size: 0.85rem; color: var(--fg-subtle); margin: 0; }

	.not-ready {
		background: none;
		border: none;
		font-size: 0.8rem;
		color: var(--fg-subtle);
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 2px;
		margin-top: 0.5rem;
	}

	.not-ready:hover { color: var(--fg-muted); }
</style>
