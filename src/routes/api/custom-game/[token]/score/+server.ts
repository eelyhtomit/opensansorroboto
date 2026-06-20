import { json, error } from '@sveltejs/kit';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { RESEND_API_KEY } from '$env/static/private';
import { cleanOptionalName, cleanOptionalEmail } from '$lib/server/customGame';
import { CUSTOM_QUESTION_COUNT } from '$lib/data/fonts';
import type { RequestHandler } from './$types';

const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL as string,
	import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const resend = new Resend(RESEND_API_KEY);

const SITE_ORIGIN = 'https://opensansorroboto.com';

/**
 * Escape a string for safe interpolation into HTML.
 * Prevents stored HTML/script injection in notification emails.
 */
function escapeHtml(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Strip control characters (incl. CR/LF) for safe use in an email header
 * such as the subject line. Prevents header-injection attempts.
 */
function sanitizeHeader(input: string): string {
	// eslint-disable-next-line no-control-regex
	return input.replace(/[\r\n\u0000-\u001F\u007F]/g, ' ').trim();
}

/**
 * POST /api/custom-game/[token]/score
 * Body: { name: string, email?: string, score: number, time_ms: number }
 * Records a score on the per-token leaderboard and returns the player's rank.
 */
export const POST: RequestHandler = async ({ request, params }) => {
	const token = params.token;
	if (!token) throw error(400, 'Missing game token');

	const body = await request.json().catch(() => null);
	if (!body) throw error(400, 'Invalid JSON');

	const { name, email, score, time_ms } = body as {
		name: unknown;
		email?: unknown;
		score: unknown;
		time_ms: unknown;
	};

	// ------------------------------------------------------------------
	// Strict server-side validation (never trust the client)
	// ------------------------------------------------------------------
	const cleanName = cleanOptionalName(name);
	if (!cleanName) throw error(400, 'Missing or invalid name');

	// Email is optional; reject only when a present value is malformed.
	const emailResult = cleanOptionalEmail(email);
	if ('error' in emailResult) throw error(400, 'Invalid email');
	const cleanEmail = emailResult.email;

	if (
		typeof score !== 'number' ||
		!Number.isInteger(score) ||
		score < 0 ||
		score > CUSTOM_QUESTION_COUNT
	) {
		throw error(400, 'Invalid score');
	}
	if (typeof time_ms !== 'number' || !Number.isFinite(time_ms) || time_ms < 0) {
		throw error(400, 'Invalid time');
	}

	// ------------------------------------------------------------------
	// 1. Confirm the game token exists (FK-ish guard + friendly 404).
	//    Also pull the fonts so the notification email can name the game.
	// ------------------------------------------------------------------
	const { data: gameRow, error: gameErr } = await supabase
		.from('custom_games')
		.select('token, fonts')
		.eq('token', token)
		.maybeSingle();

	if (gameErr) {
		console.error('custom_games lookup error:', gameErr);
		throw error(500, 'Could not save score');
	}
	if (!gameRow) throw error(404, 'Game not found');

	const fonts = Array.isArray(gameRow.fonts) ? (gameRow.fonts as string[]) : [];

	// ------------------------------------------------------------------
	// 2. Find existing entries this new score beats. Leaderboard entries are
	//    always perfect 10/10 runs, so a faster time alone beats a slower one.
	//    Limited to rows WITH an email set and NOT yet notified, and computed
	//    BEFORE the insert so the new row can't match itself.
	// ------------------------------------------------------------------
	const { data: beatenRows } = await supabase
		.from('custom_game_scores')
		.select('id, name, email')
		.eq('token', token)
		.gt('time_ms', time_ms) // their time is slower → they're beaten
		.not('email', 'is', null)
		.is('notified_at', null);

	const beaten = beatenRows ?? [];

	// ------------------------------------------------------------------
	// 3. Insert the score
	// ------------------------------------------------------------------
	const { data: inserted, error: insertError } = await supabase
		.from('custom_game_scores')
		.insert({ token, name: cleanName, email: cleanEmail, score, time_ms })
		.select('id')
		.single();

	if (insertError) {
		console.error('custom_game_scores insert error:', insertError);
		throw error(500, 'Could not save score');
	}

	// ------------------------------------------------------------------
	// 4. Compute rank — entries are always perfect 10/10, so rank by fastest
	//    time: this score's rank is the number of strictly faster times + 1.
	// ------------------------------------------------------------------
	const { count: fasterCount } = await supabase
		.from('custom_game_scores')
		.select('*', { count: 'exact', head: true })
		.eq('token', token)
		.lt('time_ms', time_ms);

	const rank = (fasterCount ?? 0) + 1;

	// ------------------------------------------------------------------
	// 5. Notify beaten players (fire-and-forget — don't block the response).
	//    Group beaten rows by email so each address gets at most ONE email
	//    per new score, then mark ALL of that address's rows as notified.
	// ------------------------------------------------------------------
	if (beaten.length > 0) {
		const playUrl = `${SITE_ORIGIN}/play/${encodeURIComponent(token)}`;
		const safeName = escapeHtml(cleanName);
		const safeFonts = escapeHtml(fonts.join(', '));
		const safeSubject = sanitizeHeader(`${cleanName} just beat your score!`);

		const rowsByEmail = new Map<string, { displayEmail: string; ids: string[] }>();
		for (const row of beaten) {
			if (!row.email) continue;
			// Normalize the key so case variants of the same address collapse together.
			const key = (row.email as string).trim().toLowerCase();
			const group = rowsByEmail.get(key);
			if (group) {
				group.ids.push(row.id as string);
			} else {
				rowsByEmail.set(key, { displayEmail: row.email as string, ids: [row.id as string] });
			}
		}

		await Promise.allSettled(
			Array.from(rowsByEmail.values()).map(async ({ displayEmail, ids }) => {
				const result = await resend.emails.send({
					from: 'Open Sans or Roboto? <montserrat@opensansorroboto.com>',
					replyTo: 'montserrat@opensansorroboto.com',
					to: displayEmail,
					subject: safeSubject,
					html: `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem;color:#111">
	 <h2 style="font-size:1.25rem;font-weight:600;margin:0 0 1rem">Your score was just beaten 👀</h2>
	 <p style="margin:0 0 0.75rem;color:#444">
	   <strong>${safeName}</strong> just beat your score on a custom font-guessing challenge${
				safeFonts ? ` (<strong>${safeFonts}</strong>)` : ''
			} on
	   <a href="${playUrl}" style="color:#111">Open Sans or Roboto?</a>
	 </p>
	 <p style="margin:0 0 1.5rem;color:#444">Think you can reclaim the top spot?</p>
	 <a href="${playUrl}"
	    style="display:inline-block;padding:0.65rem 1.25rem;background:#111;color:#fff;text-decoration:none;font-size:0.9rem">
	   Play again →
	 </a>
	 <p style="margin:1.5rem 0 0;font-size:0.75rem;color:#999">
	   You received this because you opted in when saving your score.
	 </p>
</div>`
				});

				// Only mark as notified if the email was sent successfully. Mark every
				// beaten row for this address so none of them re-triggers next time.
				if (!result.error) {
					await supabase
						.from('custom_game_scores')
						.update({ notified_at: new Date().toISOString() })
						.in('id', ids);
				}
			})
		);
	}

	return json({ ok: true, rank, id: inserted?.id ?? null });
};
