import { supabase } from '$lib/supabase';
import { FONTS, FONTS_RANDOM, DIFFICULTY_FONTS, DIFFICULTY_QUESTION_COUNT, randomFontSize } from '$lib/data/fonts';
import type { Difficulty, FontConfig } from '$lib/data/fonts';
import type { Question } from '$lib/stores/gameStore';

type StyleVariant = Pick<Question, 'fontStyle' | 'fontWeight' | 'textTransform' | 'letterSpacing'>;

// ---------------------------------------------------------------------------
// Phrases cache — kick off the fetch immediately when this module is imported
// so the data is ready (or nearly ready) by the time the user picks a difficulty.
// ---------------------------------------------------------------------------
let phrasesCache: string[] | null = null;
let phrasesFetchInFlight: Promise<string[]> | null = null;

function fetchPhrases(): Promise<string[]> {
	// Already resolved — return synchronously wrapped value
	if (phrasesCache) return Promise.resolve(phrasesCache);
	// In-flight request exists — share it
	if (phrasesFetchInFlight) return phrasesFetchInFlight;

	const p = Promise.resolve(
		supabase.from('phrases').select('text').order('id').limit(100)
	).then(({ data, error }: { data: { text: string }[] | null; error: { message: string } | null }) => {
		phrasesFetchInFlight = null;
		if (error) throw new Error(`Failed to fetch phrases: ${error.message}`);
		if (!data || data.length === 0) throw new Error('Not enough phrases in the database. Please seed the phrases table.');
		phrasesCache = data.map((d) => d.text);
		return phrasesCache as string[];
	}).catch((err: unknown) => {
		phrasesFetchInFlight = null;
		throw err;
	});

	phrasesFetchInFlight = p;
	return p;
}

// Warm up immediately on module import (fires in the background, errors are
// silently swallowed here — generateQuestions will surface them properly).
fetchPhrases().catch(() => {});

const DIABOLICAL_STYLES: StyleVariant[] = [
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none',      letterSpacing: 'normal' },
	{ fontStyle: 'italic', fontWeight: 'normal', textTransform: 'none',      letterSpacing: 'normal' },
	{ fontStyle: 'normal', fontWeight: 'bold',   textTransform: 'none',      letterSpacing: 'normal' },
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: 'normal' },
	{ fontStyle: 'italic', fontWeight: 'bold',   textTransform: 'none',      letterSpacing: 'normal' },
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none',      letterSpacing: '-0.05em' },
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none',      letterSpacing: '0.15em'  },
	{ fontStyle: 'italic', fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: '0.1em'   },
	{ fontStyle: 'normal', fontWeight: 'bold',   textTransform: 'uppercase', letterSpacing: '-0.03em' },
	{ fontStyle: 'italic', fontWeight: 'bold',   textTransform: 'uppercase', letterSpacing: '0.08em'  },
];

function randomStyle(difficulty: Difficulty): StyleVariant {
	// Only diabolical gets bold/italic/spacing variations
	if (difficulty === 'diabolical') {
		return DIABOLICAL_STYLES[Math.floor(Math.random() * DIABOLICAL_STYLES.length)];
	}
	return { fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none', letterSpacing: 'normal' };
}

export async function generateQuestions(difficulty: Difficulty): Promise<{ questions: Question[]; fontPool: FontConfig[] }> {
	const count = DIFFICULTY_QUESTION_COUNT[difficulty];

	// Uses the already-in-flight (or resolved) cached promise — no extra round-trip.
	const allPhrases = await fetchPhrases();
	if (allPhrases.length < count) throw new Error('Not enough phrases in the database. Please seed the phrases table.');

	const phrases = shuffle([...allPhrases]).slice(0, count);

	// For medium: Open Sans + Roboto + 2 randomly picked from FONTS_RANDOM (per session)
	// For hard:   Open Sans + Roboto + 4 randomly picked from FONTS_RANDOM (per session)
	// For diabolical: Open Sans + Roboto + 6 randomly picked from FONTS_RANDOM (8 total)
	let fontPool: FontConfig[];
	if (difficulty === 'medium') {
		// Fixed pool: Open Sans, Roboto, Arial, Montserrat
		fontPool = FONTS.filter((f) =>
			['Open Sans', 'Roboto', 'Arial', 'Montserrat'].includes(f.name)
		);
	} else if (difficulty === 'hard') {
		const fourRandom = shuffle([...FONTS_RANDOM]).slice(0, 4);
		fontPool = [...FONTS.slice(0, 2), ...fourRandom];
	} else if (difficulty === 'diabolical') {
		const sixRandom = shuffle([...FONTS_RANDOM]).slice(0, 6);
		fontPool = [...FONTS.slice(0, 2), ...sixRandom];
	} else {
		fontPool = DIFFICULTY_FONTS[difficulty];
	}

	// Guarantee every font in pool appears at least once (up to pool size)
	const guaranteed = shuffle([...fontPool]).slice(0, Math.min(fontPool.length, count));

	const questions: Question[] = [];
	for (let i = 0; i < count; i++) {
		const font = i < guaranteed.length ? guaranteed[i] : fontPool[Math.floor(Math.random() * fontPool.length)];
		const forcedTheme: Question['forcedTheme'] =
			difficulty === 'diabolical' ? (Math.random() < 0.5 ? 'light' : 'dark') : null;
		questions.push({
			phrase: phrases[i],
			font,
			fontSize: randomFontSize(difficulty),
			...randomStyle(difficulty),
			forcedTheme,
			answered: false,
			correct: null,
			userAnswer: null
		});
	}

	return { questions: shuffle(questions), fontPool };
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
