<script lang="ts">
	import { game } from '$lib/stores/gameStore';

	function fmt(ms: number): string {
		const s = Math.floor(ms / 1000);
		const cents = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
		return `${s}.${cents}s`;
	}
</script>

<div class="timer" aria-live="polite">
	{fmt($game.timerMs)}
</div>

<style>
	.timer {
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
		color: var(--fg-muted);
		letter-spacing: 0.02em;
	}
</style>
