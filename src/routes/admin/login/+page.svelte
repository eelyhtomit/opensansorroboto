<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Admin Login</title>
</svelte:head>

<main>
	<div class="card">
		<h1>Admin Login</h1>

		<form method="POST" use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				update();
			};
		}}>
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}

			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="username"
				placeholder="you@example.com"
				required
			/>

			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				placeholder="••••••••"
				required
			/>

			<button type="submit" disabled={loading}>
				{loading ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	</div>
</main>

<style>
	main {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f4f4f5;
		font-family: system-ui, sans-serif;
	}

	.card {
		background: #fff;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		padding: 2rem;
		width: 100%;
		max-width: 360px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 1.5rem;
		color: #111;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-size: 0.8rem;
		font-weight: 500;
		color: #444;
		margin-top: 0.25rem;
	}

	input {
		padding: 0.55rem 0.75rem;
		border: 1px solid #d4d4d8;
		border-radius: 5px;
		font-size: 0.95rem;
		outline: none;
		transition: border-color 0.15s;
		color: #111;
	}

	input:focus {
		border-color: #111;
	}

	button {
		margin-top: 0.75rem;
		padding: 0.65rem;
		background: #111;
		color: #fff;
		border: none;
		border-radius: 5px;
		font-size: 0.95rem;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #b91c1c;
		border-radius: 5px;
		padding: 0.55rem 0.75rem;
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
	}
</style>
