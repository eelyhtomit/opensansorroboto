<script lang="ts">
	import { goto } from '$app/navigation';
	import { game } from '$lib/stores/gameStore';
	import {
		FONTS,
		CUSTOM_MIN_FONTS,
		CUSTOM_MAX_FONTS,
		CUSTOM_QUESTION_COUNT,
		type FontConfig
	} from '$lib/data/fonts';
	import { t } from 'svelte-i18n';

	// Step 1: how many fonts to guess between (2–4). Null until the player picks.
	let fontCount = $state<number | null>(null);

	// Step 2: the chosen font name for each slot. `null` = not yet picked, which
	// keeps the dropdown on its placeholder and gates the reveal of the next one.
	let picked = $state<(string | null)[]>(Array(CUSTOM_MAX_FONTS).fill(null));

	let loading = $state(false);
	let errorMsg = $state('');

	const countOptions = Array.from(
		{ length: CUSTOM_MAX_FONTS - CUSTOM_MIN_FONTS + 1 },
		(_, i) => CUSTOM_MIN_FONTS + i
	);

	// Active slot values limited to the chosen count.
	const active = $derived(fontCount === null ? [] : picked.slice(0, fontCount));

	// Once a count is chosen, show all of that many dropdowns at once.
	const visibleCount = $derived(fontCount ?? 0);

	// Every visible slot has a selection → ready to start.
	const allChosen = $derived(
		fontCount !== null && active.every((v) => v !== null)
	);

	const hasDuplicates = $derived.by(() => {
		const chosen = active.filter((v): v is string => v !== null);
		return new Set(chosen).size !== chosen.length;
	});

	function chooseCount(n: number) {
		fontCount = n;
		// Reset any previous picks so the flow always starts clean.
		picked = Array(CUSTOM_MAX_FONTS).fill(null);
		errorMsg = '';
	}

	// Fonts still available for a given slot: those not chosen in *other* slots.
	function optionsFor(slotIndex: number): FontConfig[] {
		const takenElsewhere = new Set(
			active.filter((v, i): v is string => v !== null && i !== slotIndex)
		);
		return FONTS.filter(
			(f) => f.name === picked[slotIndex] || !takenElsewhere.has(f.name)
		);
	}

	function updateSlot(slotIndex: number, value: string) {
		picked[slotIndex] = value === '' ? null : value;
		errorMsg = '';
	}

	// Resolve the chosen slot values into canonical FontConfig objects.
	function selectedPool(): FontConfig[] {
		return active
			.filter((v): v is string => v !== null)
			.map((name) => FONTS.find((f) => f.name === name))
			.filter((f): f is FontConfig => Boolean(f));
	}

	// Create a shareable game with its own per-token leaderboard, then navigate
	// to /play/[token] so the creator plays it and the link is shareable. Names
	// are collected only after a perfect run (like the preset difficulties), so
	// nothing is captured here at creation time.
	async function createSharedGame() {
		if (fontCount === null || !allChosen || hasDuplicates) return;
		loading = true;
		errorMsg = '';
		try {
			const fonts = selectedPool().map((f) => f.name);
			const res = await fetch('/api/custom-game', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fonts })
			});
			if (!res.ok) throw new Error('server error');
			const data = await res.json();
			if (!data.token) throw new Error('server error');
			await goto(`/play/${data.token}`);
		} catch (e: unknown) {
			errorMsg = e instanceof Error && e.message !== 'server error'
				? e.message
				: $t('custom_share.create_error');
			loading = false;
		}
	}
</script>

<div class="custom-config">
	<div class="header">
		<h1 class="title">{$t('custom.title')}</h1>
		<p class="subtitle">{$t('custom.subtitle', { values: { count: CUSTOM_QUESTION_COUNT } })}</p>
	</div>

	<div class="field">
		<p class="field-label">{$t('custom.how_many')}</p>
		<div class="count-row">
			{#each countOptions as n}
				<button
					class="count-btn"
					class:active={fontCount === n}
					disabled={loading}
					onclick={() => chooseCount(n)}
				>
					{n}
				</button>
			{/each}
		</div>
	</div>

	{#if fontCount !== null}
		<div class="field">
			<p class="field-label">{$t('custom.pick_fonts')}</p>
			<div class="font-list">
				{#each Array(visibleCount) as _, i}
					<div class="font-row">
						<span class="font-index">{i + 1}</span>
						<select
							class="font-select"
							class:placeholder={picked[i] === null}
							value={picked[i] ?? ''}
							disabled={loading}
							onchange={(e) => updateSlot(i, (e.target as HTMLSelectElement).value)}
						>
							<option value="" disabled>{$t('custom.select_font')}</option>
							{#each optionsFor(i) as font}
								<option value={font.name}>{font.name}</option>
							{/each}
						</select>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if hasDuplicates}
		<p class="error">{$t('custom.duplicate_error')}</p>
	{:else if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	{#if allChosen && !hasDuplicates}
		<button class="start-btn" disabled={loading} onclick={createSharedGame}>
			{loading ? $t('custom.starting') : $t('custom.start')}
		</button>
	{/if}

	<button class="back-link" disabled={loading} onclick={() => game.goTo('difficulty')}>
		{$t('custom.back')}
	</button>
</div>

<style>
	.custom-config {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		padding: 4rem 2rem;
	}

	@media (max-width: 640px) {
		.custom-config {
			padding: 1.5rem 1rem;
		}
	}

	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}

	.title {
		font-size: 2rem;
		font-weight: 500;
		letter-spacing: -0.03em;
		margin: 0;
		color: var(--fg);
	}

	.subtitle {
		color: var(--fg-muted);
		margin: 0;
		font-size: 0.95rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 420px;
	}

	.field-label {
		font-size: 0.8rem;
		color: var(--fg-subtle);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin: 0;
		text-align: left;
	}

	.count-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.count-btn {
		padding: 0.8rem 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg);
		font-size: 0.95rem;
		color: var(--fg);
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s;
		min-height: 44px;
	}

	.count-btn:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: var(--fg-muted);
	}

	.count-btn.active {
		background: var(--fg);
		border-color: var(--fg);
		color: var(--bg);
		font-weight: 500;
	}

	.count-btn:disabled {
		opacity: 0.4;
		cursor: wait;
	}

	.font-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.font-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		animation: reveal 0.18s ease-out;
	}

	@keyframes reveal {
		from { opacity: 0; transform: translateY(-4px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.font-index {
		font-size: 0.8rem;
		color: var(--fg-subtle);
		font-variant-numeric: tabular-nums;
		width: 1.2ch;
		text-align: center;
		flex-shrink: 0;
	}

	.font-select {
		flex: 1;
		padding: 0.7rem 0.75rem;
		border: 1px solid var(--border);
		font-size: 0.9rem;
		background: var(--bg);
		color: var(--fg);
		cursor: pointer;
		outline: none;
		appearance: none;
		-webkit-appearance: none;
		padding-right: 2rem;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='none' stroke='%23999' stroke-width='1.5' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
	}

	.font-select.placeholder {
		color: var(--fg-subtle);
	}

	.font-select:focus {
		border-color: var(--fg);
	}

	.font-select:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.error {
		font-size: 0.82rem;
		color: var(--fg);
		text-align: center;
		margin: 0;
		max-width: 420px;
	}

	.start-btn {
		width: 100%;
		max-width: 420px;
		padding: 0.9rem 1rem;
		border: 1px solid var(--fg);
		background: var(--fg);
		color: var(--bg);
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.1s;
		animation: reveal 0.18s ease-out;
	}

	.start-btn:hover:not(:disabled) {
		opacity: 0.85;
	}

	.start-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.back-link {
		background: none;
		border: none;
		color: var(--fg-subtle);
		font-size: 0.85rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		padding: 0;
	}

	.back-link:hover:not(:disabled) {
		color: var(--fg);
	}

	.back-link:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
