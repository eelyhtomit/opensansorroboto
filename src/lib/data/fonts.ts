export type Difficulty = 'easy' | 'medium' | 'hard' | 'diabolical';

export interface FontConfig {
	name: string;
	family: string;
}

export const FONTS: FontConfig[] = [
	{ name: 'Open Sans', family: "'Open Sans', sans-serif" },
	{ name: 'Roboto', family: "'Roboto', sans-serif" },
	{ name: 'Lato', family: "'Lato', sans-serif" },
	{ name: 'Montserrat', family: "'Montserrat', sans-serif" },
	{ name: 'Poppins', family: "'Poppins', sans-serif" },
	{ name: 'Inter', family: "'Inter', sans-serif" },
	{ name: 'Verdana', family: "Verdana, sans-serif" },
	{ name: 'Source Sans Pro', family: "'Source Sans Pro', sans-serif" },
	{ name: 'Arial', family: "Arial, sans-serif" },
	{ name: 'Helvetica', family: "Helvetica, Arial, sans-serif" }
];

// Fonts excluding Open Sans and Roboto (used as random display fonts for medium/hard)
export const FONTS_RANDOM: FontConfig[] = FONTS.filter(
	(f) => f.name !== 'Open Sans' && f.name !== 'Roboto'
);

export const DIFFICULTY_FONTS: Record<Difficulty, FontConfig[]> = {
	easy: FONTS.slice(0, 2),  // Open Sans, Roboto only
	medium: FONTS.slice(0, 2), // Base: Open Sans + Roboto; 2 random from FONTS_RANDOM added per session in generateQuestions
	hard: FONTS_RANDOM,        // All non-Open-Sans/Roboto fonts — randomised
	diabolical: [...FONTS]     // All 10 fonts — randomised styles + letter spacing
};

export const DIFFICULTY_QUESTION_COUNT: Record<Difficulty, number> = {
	easy: 10,
	medium: 10,
	hard: 5,
	diabolical: 5
};

export const DIFFICULTY_FONT_SIZE: Record<Difficulty, { min: number; max: number }> = {
	easy:       { min: 32, max: 56 },
	medium:     { min: 28, max: 64 },
	hard:       { min: 22, max: 72 },
	diabolical: { min: 14, max: 72 }
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
	easy: 'Easy',
	medium: 'Medium',
	hard: 'Hard',
	diabolical: 'Diabolical'
};

export function randomFontSize(difficulty: Difficulty): number {
	const { min, max } = DIFFICULTY_FONT_SIZE[difficulty];
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFont(difficulty: Difficulty): FontConfig {
	const pool = DIFFICULTY_FONTS[difficulty];
	return pool[Math.floor(Math.random() * pool.length)];
}
