import { supabase } from '$lib/supabase';
import { DIFFICULTY_FONTS, DIFFICULTY_QUESTION_COUNT, randomFont, randomFontSize } from '$lib/data/fonts';
import type { Difficulty } from '$lib/data/fonts';
import type { Question } from '$lib/stores/gameStore';

type StyleVariant = Pick<Question, 'fontStyle' | 'fontWeight' | 'textTransform' | 'letterSpacing'>;

const NORMAL_STYLES: StyleVariant[] = [
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none',      letterSpacing: 'normal' },
	{ fontStyle: 'italic', fontWeight: 'normal', textTransform: 'none',      letterSpacing: 'normal' },
	{ fontStyle: 'normal', fontWeight: 'bold',   textTransform: 'none',      letterSpacing: 'normal' },
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: 'normal' },
	{ fontStyle: 'italic', fontWeight: 'bold',   textTransform: 'none',      letterSpacing: 'normal' },
];

const DIABOLICAL_STYLES: StyleVariant[] = [
	...NORMAL_STYLES,
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none',      letterSpacing: '-0.05em' },
	{ fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none',      letterSpacing: '0.15em'  },
	{ fontStyle: 'italic', fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: '0.1em'   },
	{ fontStyle: 'normal', fontWeight: 'bold',   textTransform: 'uppercase', letterSpacing: '-0.03em' },
	{ fontStyle: 'italic', fontWeight: 'bold',   textTransform: 'uppercase', letterSpacing: '0.08em'  },
];

function randomStyle(difficulty: Difficulty): StyleVariant {
	if (difficulty === 'easy' || difficulty === 'medium') {
		return { fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none', letterSpacing: 'normal' };
	}
	// Hard: 40% chance of a variation, otherwise normal
	if (difficulty === 'hard') {
		if (Math.random() > 0.4) {
			return { fontStyle: 'normal', fontWeight: 'normal', textTransform: 'none', letterSpacing: 'normal' };
		}
		return NORMAL_STYLES[Math.floor(Math.random() * NORMAL_STYLES.length)];
	}
	// Diabolical: always randomised from extended pool
	return DIABOLICAL_STYLES[Math.floor(Math.random() * DIABOLICAL_STYLES.length)];
}

export async function generateQuestions(difficulty: Difficulty): Promise<Question[]> {
	const count = DIFFICULTY_QUESTION_COUNT[difficulty];

	const { data, error } = await supabase
		.from('phrases')
		.select('text')
		.order('id')
		.limit(100);

	if (error) throw new Error(`Failed to fetch phrases: ${error.message}`);
	if (!data || data.length < count) throw new Error('Not enough phrases in the database. Please seed the phrases table.');

	const phrases = shuffle(data.map((d: { text: string }) => d.text)).slice(0, count);
	const fontPool = DIFFICULTY_FONTS[difficulty];

	// Guarantee every font in pool appears at least once (up to pool size)
	const guaranteed = shuffle([...fontPool]).slice(0, Math.min(fontPool.length, count));

	const questions: Question[] = [];
	for (let i = 0; i < count; i++) {
		const font = i < guaranteed.length ? guaranteed[i] : randomFont(difficulty);
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

	return shuffle(questions);
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
