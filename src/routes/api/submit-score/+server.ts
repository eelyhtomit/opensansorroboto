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

const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard', 'diabolical'];
const MAX_NAME_LENGTH = 32;
const MAX_EMAIL_LENGTH = 254;
// Basic, conservative email shape check (defense-in-depth, not full RFC 5322)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body) throw error(400, 'Invalid JSON');

	const { name, email, time_ms, difficulty } = body as {
		name: unknown;
		email?: unknown;
		time_ms: unknown;
		difficulty: unknown;
	};

	// ------------------------------------------------------------------
	// 0. Strict server-side validation (never trust the client)
	// ------------------------------------------------------------------
	if (typeof name !== 'string' || !name.trim()) {
		throw error(400, 'Missing or invalid name');
	}
	if (typeof time_ms !== 'number' || !Number.isFinite(time_ms) || time_ms < 0) {
		throw error(400, 'Missing or invalid time');
	}
	if (typeof difficulty !== 'string' || !ALLOWED_DIFFICULTIES.includes(difficulty)) {
		throw error(400, 'Invalid difficulty');
	}

	const cleanName = name.trim().slice(0, MAX_NAME_LENGTH);

	let cleanEmail: string | null = null;
	if (email !== undefined && email !== null && email !== '') {
		if (
			typeof email !== 'string' ||
			email.length > MAX_EMAIL_LENGTH ||
			!EMAIL_RE.test(email.trim())
		) {
			throw error(400, 'Invalid email');
		}
		cleanEmail = email.trim();
	}

	// Pre-escaped/-sanitized values for use in the outgoing email
	const safeName = escapeHtml(cleanName);
	const safeDifficulty = escapeHtml(difficulty);
	const safeSubject = sanitizeHeader(`${cleanName} just beat your score!`);

	// ------------------------------------------------------------------
	// 1. Find existing entries that will be beaten by this new score
	//    (faster time = smaller time_ms) — only those WITH an email set
	// ------------------------------------------------------------------
	const { data: beaten } = await supabase
		.from('leaderboard')
		.select('id, name, email')
		.eq('difficulty', difficulty)
		.gt('time_ms', time_ms) // their time is slower → they're beaten
		.not('email', 'is', null)
		.is('notified_at', null); // only notify once — skip already-notified entries

	// ------------------------------------------------------------------
	// 2. Insert new score
	// ------------------------------------------------------------------
	const { data: inserted, error: insertError } = await supabase
		.from('leaderboard')
		.insert({
			name: cleanName,
			email: cleanEmail,
			time_ms,
			difficulty
		})
		.select('id')
		.single();

	if (insertError) {
		console.error('Leaderboard insert error:', insertError);
		throw error(500, 'Could not save score');
	}

	// ------------------------------------------------------------------
	// 2b. Compute rank (how many entries are faster than this score)
	// ------------------------------------------------------------------
	const LEADERBOARD_LIMITS: Record<string, number> = { easy: 50, medium: 50, hard: 20, diabolical: 20 };
	const limit = LEADERBOARD_LIMITS[difficulty] ?? 50;

	const { count: fasterCount } = await supabase
		.from('leaderboard')
		.select('*', { count: 'exact', head: true })
		.eq('difficulty', difficulty)
		.lt('time_ms', time_ms);

	// rank is 1-based; fasterCount = number of entries strictly faster
	const rank = (fasterCount ?? 0) + 1;
	const onBoard = rank <= limit;

	// ------------------------------------------------------------------
	// 3. Notify beaten players (fire-and-forget, don't block the response)
	// ------------------------------------------------------------------
	if (beaten && beaten.length > 0) {
		// A single player can hold several beaten rows (e.g. multiple saved games
		// with the same email). Group those rows by email so each address gets at
		// most ONE notification per new score, then mark ALL of that address's
		// beaten rows as notified.
		const rowsByEmail = new Map<string, { displayEmail: string; ids: string[] }>();
		for (const row of beaten) {
			if (!row.email) continue;
			// Normalize the key so case variants of the same address collapse together.
			const key = (row.email as string).trim().toLowerCase();
			const group = rowsByEmail.get(key);
			if (group) {
				group.ids.push(row.id);
			} else {
				rowsByEmail.set(key, { displayEmail: row.email as string, ids: [row.id] });
			}
		}

		// Send one notification per unique email and mark its rows as notified.
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
	   <strong>${safeName}</strong> just completed the <strong>${safeDifficulty}</strong> challenge faster than you on
	   <a href="https://opensansorroboto.com" style="color:#111">Open Sans or Roboto?</a>
	 </p>
	 <p style="margin:0 0 1.5rem;color:#444">Think you can reclaim the top spot?</p>
	 <a href="https://opensansorroboto.com"
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
						.from('leaderboard')
						.update({ notified_at: new Date().toISOString() })
						.in('id', ids);
				}
			})
		);
	}

	return json({ ok: true, onBoard, rank, id: inserted?.id ?? null });
};
