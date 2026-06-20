import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import {
	validateFonts,
	cleanOptionalName,
	generateToken
} from '$lib/server/customGame';
import type { RequestHandler } from './$types';

// Server-side Supabase client — VITE_ vars are available via import.meta.env on the server too
const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL as string,
	import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// How many times to retry token generation on a primary-key collision.
const MAX_TOKEN_ATTEMPTS = 6;

/**
 * POST /api/custom-game
 * Body: { fonts: string[], creatorName?: string }
 * Creates a shareable custom game and returns its token.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body) throw error(400, 'Invalid JSON');

	const { fonts, creatorName } = body as { fonts: unknown; creatorName?: unknown };

	const result = validateFonts(fonts);
	if ('error' in result) throw error(400, result.error);

	const cleanCreator = cleanOptionalName(creatorName);

	// Insert with a fresh token, retrying if the random token already exists.
	for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
		const token = generateToken();
		const { error: insertError } = await supabase.from('custom_games').insert({
			token,
			fonts: result.fonts,
			font_count: result.fonts.length,
			creator_name: cleanCreator
		});

		if (!insertError) {
			return json({ token });
		}

		// 23505 = unique_violation (token collision) → try a new token.
		if (insertError.code !== '23505') {
			console.error('custom_games insert error:', insertError);
			throw error(500, 'Could not create game');
		}
	}

	throw error(500, 'Could not generate a unique game link, please try again');
};
