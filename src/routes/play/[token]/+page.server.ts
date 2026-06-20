import { createClient } from '@supabase/supabase-js';
import type { PageServerLoad } from './$types';

const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL as string,
	import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

/**
 * Load the settings (fonts + creator) behind a shareable custom-game token.
 * A missing token resolves to `{ game: null }` so the page can show a friendly
 * "game not found" state rather than a hard error.
 */
export const load: PageServerLoad = async ({ params }) => {
	const token = params.token;

	const { data, error: dbErr } = await supabase
		.from('custom_games')
		.select('token, fonts, font_count, creator_name')
		.eq('token', token)
		.maybeSingle();

	if (dbErr || !data) {
		return { game: null };
	}

	return {
		game: {
			token: data.token as string,
			fonts: (data.fonts as string[]) ?? [],
			fontCount: data.font_count as number,
			creatorName: (data.creator_name as string | null) ?? null
		}
	};
};
