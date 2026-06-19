<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let sending = $state(false);

	// Preserve field values from server on error; clear on success
	let to = $state((form as any)?.to ?? '');
	let subject = $state((form as any)?.subject ?? '');
	let body = $state((form as any)?.body ?? '');

	$effect(() => {
		if ((form as any)?.success) {
			to = '';
			subject = '';
			body = '';
		} else if (form) {
			to = (form as any).to ?? to;
			subject = (form as any).subject ?? subject;
			body = (form as any).body ?? body;
		}
	});
</script>

<svelte:head>
	<title>Send Email — Admin</title>
</svelte:head>

<main>
	<div class="shell">
		<header>
			<h1>Send Email</h1>
			<form method="POST" action="?/logout" class="logout-form">
				<button type="submit" class="logout">Sign out</button>
			</form>
		</header>

		<div class="from-badge">
			From: <strong>montserrat@opensansorroboto.com</strong>
		</div>

		{#if (form as any)?.success}
			<div class="banner success">
				✓ Email sent successfully!
				{#if (form as any).messageId}
					<span class="msg-id">ID: {(form as any).messageId}</span>
				{/if}
			</div>
		{/if}

		{#if (form as any)?.error}
			<div class="banner error">{(form as any).error}</div>
		{/if}

		<form
			method="POST"
			action="?/send"
			class="compose"
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					sending = false;
					update();
				};
			}}
		>
			<label for="to">To</label>
			<input
				id="to"
				name="to"
				type="email"
				placeholder="recipient@example.com"
				bind:value={to}
				required
			/>

			<label for="subject">Subject</label>
			<input
				id="subject"
				name="subject"
				type="text"
				placeholder="Your subject here"
				bind:value={subject}
				required
			/>

			<label for="body">Body</label>
			<textarea
				id="body"
				name="body"
				rows="12"
				placeholder="Write your message…"
				bind:value={body}
				required
			></textarea>

			<div class="actions">
				<button type="submit" class="send-btn" disabled={sending}>
					{sending ? 'Sending…' : 'Send Email'}
				</button>
			</div>
		</form>
	</div>
</main>

<style>
	main {
		min-height: 100dvh;
		background: #f4f4f5;
		font-family: system-ui, sans-serif;
		display: flex;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.shell {
		width: 100%;
		max-width: 640px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #111;
		margin: 0;
	}

	.logout {
		background: none;
		border: 1px solid #d4d4d8;
		border-radius: 5px;
		padding: 0.35rem 0.75rem;
		font-size: 0.8rem;
		cursor: pointer;
		color: #555;
		transition: border-color 0.15s, color 0.15s;
	}

	.logout:hover {
		border-color: #888;
		color: #111;
	}

	.logout-form {
		margin: 0;
	}

	.from-badge {
		font-size: 0.82rem;
		color: #666;
		background: #fff;
		border: 1px solid #e4e4e7;
		border-radius: 5px;
		padding: 0.5rem 0.75rem;
	}

	.banner {
		border-radius: 5px;
		padding: 0.65rem 0.85rem;
		font-size: 0.875rem;
	}

	.banner.success {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		color: #15803d;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.msg-id {
		font-size: 0.75rem;
		color: #166534;
		font-family: monospace;
	}

	.banner.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #b91c1c;
	}

	.compose {
		background: #fff;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
	}

	label {
		font-size: 0.8rem;
		font-weight: 500;
		color: #444;
		margin-top: 0.4rem;
	}

	input,
	textarea {
		padding: 0.55rem 0.75rem;
		border: 1px solid #d4d4d8;
		border-radius: 5px;
		font-size: 0.95rem;
		font-family: inherit;
		outline: none;
		color: #111;
		transition: border-color 0.15s;
		resize: vertical;
	}

	input:focus,
	textarea:focus {
		border-color: #111;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.send-btn {
		padding: 0.65rem 1.5rem;
		background: #111;
		color: #fff;
		border: none;
		border-radius: 5px;
		font-size: 0.95rem;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.send-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
