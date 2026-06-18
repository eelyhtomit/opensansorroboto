import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL as string,
	import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard', 'diabolical'];

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body) throw error(400, 'Invalid JSON');

	const { difficulty, score, time_ms, completed } = body as {
		difficulty: unknown;
		score: unknown;
		time_ms: unknown;
		completed?: unknown;
	};

	// Strict server-side validation (never trust the client)
	if (typeof difficulty !== 'string' || !ALLOWED_DIFFICULTIES.includes(difficulty)) {
		throw error(400, 'Invalid difficulty');
	}
	if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
		throw error(400, 'Invalid score');
	}
	if (typeof time_ms !== 'number' || !Number.isFinite(time_ms) || time_ms < 0) {
		throw error(400, 'Invalid time');
	}
	if (completed !== undefined && typeof completed !== 'boolean') {
		throw error(400, 'Invalid completed flag');
	}

	const { error: insertError } = await supabase
		.from('game_plays')
		.insert({ difficulty, score, time_ms, completed: completed ?? true });

	if (insertError) {
		console.error('game_plays insert error:', insertError);
		throw error(500, 'Could not record play');
	}

	return json({ ok: true });
};
