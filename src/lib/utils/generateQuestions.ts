import { supabase } from '$lib/supabase';
import { FONTS, FONTS_RANDOM, DIFFICULTY_FONTS, DIFFICULTY_QUESTION_COUNT, randomFontSize } from '$lib/data/fonts';
import type { Difficulty, FontConfig } from '$lib/data/fonts';
import type { Question } from '$lib/stores/gameStore';

type StyleVariant = Pick<Question, 'fontStyle' | 'fontWeight' | 'textTransform' | 'letterSpacing'>;

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

	const { data, error } = await supabase
		.from('phrases')
		.select('text')
		.order('id')
		.limit(100);

	if (error) throw new Error(`Failed to fetch phrases: ${error.message}`);
	if (!data || data.length < count) throw new Error('Not enough phrases in the database. Please seed the phrases table.');

	const phrases = shuffle(data.map((d: { text: string }) => d.text)).slice(0, count);

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
