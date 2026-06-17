import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL as string,
	import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body) throw error(400, 'Invalid JSON');

	const { difficulty, score, time_ms, completed } = body as {
		difficulty: string;
		score: number;
		time_ms: number;
		completed: boolean;
	};

	if (!difficulty || typeof score !== 'number' || typeof time_ms !== 'number') {
		throw error(400, 'Missing required fields');
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
