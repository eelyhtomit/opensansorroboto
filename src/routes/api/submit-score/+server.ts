import { json, error } from '@sveltejs/kit';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { RESEND_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

// Server-side Supabase client — VITE_ vars are available via import.meta.env on the server too
const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL as string,
	import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const resend = new Resend(RESEND_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body) throw error(400, 'Invalid JSON');

	const { name, email, time_ms, difficulty } = body as {
		name: string;
		email?: string;
		time_ms: number;
		difficulty: string;
	};

	if (!name?.trim() || typeof time_ms !== 'number' || !difficulty) {
		throw error(400, 'Missing required fields');
	}

	// ------------------------------------------------------------------
	// 1. Find existing entries that will be beaten by this new score
	//    (faster time = smaller time_ms) — only those WITH an email set
	// ------------------------------------------------------------------
	const { data: beaten } = await supabase
		.from('leaderboard')
		.select('id, name, email')
		.eq('difficulty', difficulty)
		.gt('time_ms', time_ms) // their time is slower → they're beaten
		.not('email', 'is', null);

	// ------------------------------------------------------------------
	// 2. Insert new score
	// ------------------------------------------------------------------
	const { error: insertError } = await supabase.from('leaderboard').insert({
		name: name.trim(),
		email: email?.trim() || null,
		time_ms,
		difficulty
	});

	if (insertError) {
		console.error('Leaderboard insert error:', insertError);
		throw error(500, 'Could not save score');
	}

	// ------------------------------------------------------------------
	// 3. Notify beaten players (fire-and-forget, don't block the response)
	// ------------------------------------------------------------------
	if (beaten && beaten.length > 0) {
		const notifications = beaten
			.filter((row) => row.email)
			.map((row) =>
				resend.emails.send({
					from: 'Open Sans or Roboto? <montserrat@opensansorroboto.com>',
					replyTo: 'montserrat@opensansorroboto.com',
					to: row.email as string,
					subject: `${name} just beat your score!`,
					html: `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem;color:#111">
  <h2 style="font-size:1.25rem;font-weight:600;margin:0 0 1rem">Your score was just beaten 👀</h2>
  <p style="margin:0 0 0.75rem;color:#444">
    <strong>${name}</strong> just completed the <strong>${difficulty}</strong> challenge faster than you on
    <a href="https://opensansorroboto.com" style="color:#111">Open Sans or Roboto?</a>
  </p>
  <p style="margin:0 0 1.5rem;color:#444">Think you can reclaim the top spot?</p>
  <a href="https://opensansorroboto.com"
     style="display:inline-block;padding:0.65rem 1.25rem;background:#111;color:#fff;text-decoration:none;font-size:0.9rem">
    Play now →
  </a>
  <p style="margin:1.5rem 0 0;font-size:0.75rem;color:#999">
    You received this because you opted in when saving your score.
  </p>
</div>`
				})
			);

		await Promise.allSettled(notifications);
	}

	return json({ ok: true });
};
