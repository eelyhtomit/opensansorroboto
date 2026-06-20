import { writable, derived } from 'svelte/store';
import type { Difficulty, FontConfig } from '$lib/data/fonts';

export type GamePhase =
	| 'home'
	| 'difficulty'
	| 'custom_config'
	| 'countdown'
	| 'playing'
	| 'result'
	| 'leaderboard';

export interface Question {
	phrase: string;
	font: FontConfig;
	fontSize: number;
	fontStyle: 'normal' | 'italic';
	fontWeight: 'normal' | 'bold';
	textTransform: 'none' | 'uppercase';
	letterSpacing: string;
	forcedTheme: 'light' | 'dark' | null;
	answered: boolean;
	correct: boolean | null;
	userAnswer: string | null;
}

export interface GameState {
	phase: GamePhase;
	difficulty: Difficulty;
	questions: Question[];
	fontPool: FontConfig[];
	currentIndex: number;
	startTime: number | null;
	endTime: number | null;
	timerMs: number;
	highlightName: string | null;
	// The exact id of the leaderboard row the player just created. Used to
	// highlight precisely their game — name/time alone can be ambiguous.
	highlightId: string | null;
}

const initialState: GameState = {
	phase: 'home',
	difficulty: 'easy',
	questions: [],
	fontPool: [],
	currentIndex: 0,
	startTime: null,
	endTime: null,
	timerMs: 0,
	highlightName: null,
	highlightId: null
};

function createGameStore() {
	const { subscribe, set, update } = writable<GameState>(initialState);

	let timerInterval: ReturnType<typeof setInterval> | null = null;

	function startTimer() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(() => {
			update((s) => ({ ...s, timerMs: Date.now() - (s.startTime ?? Date.now()) }));
		}, 50);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	return {
		subscribe,

		setDifficulty(difficulty: Difficulty) {
			update((s) => ({ ...s, difficulty }));
		},

		// Called after questions are fetched — goes to countdown phase first
		startGameWithDifficulty(questions: Question[], difficulty: Difficulty, fontPool: FontConfig[]) {
			set({
				phase: 'countdown',
				difficulty,
				questions,
				fontPool,
				currentIndex: 0,
				startTime: null,
				endTime: null,
				timerMs: 0,
				highlightName: null,
				highlightId: null
			});
		},

		// Called by Countdown component when it hits 0
		beginPlaying() {
			const now = Date.now();
			update((s) => ({ ...s, phase: 'playing', startTime: now, timerMs: 0 }));
			startTimer();
		},

		answerQuestion(answer: string) {
			update((s) => {
				const q = s.questions[s.currentIndex];
				if (!q || q.answered) return s;

				const correct = answer === q.font.name;
				const updatedQuestions = s.questions.map((question, i) =>
					i === s.currentIndex
						? { ...question, answered: true, correct, userAnswer: answer }
						: question
				);

				const nextIndex = s.currentIndex + 1;
				const done = nextIndex >= updatedQuestions.length;

				if (done) {
					stopTimer();
					const endTime = Date.now();
					return {
						...s,
						questions: updatedQuestions,
						currentIndex: nextIndex,
						endTime,
						timerMs: endTime - (s.startTime ?? endTime),
						phase: 'result'
					};
				}

				return { ...s, questions: updatedQuestions, currentIndex: nextIndex };
			});
		},

		goTo(phase: GamePhase) {
			if (phase !== 'playing') stopTimer();
			update((s) => ({ ...s, phase }));
		},

		goToLeaderboardHighlighting(name: string, id: string | null = null) {
			stopTimer();
			update((s) => ({
				...s,
				phase: 'leaderboard',
				highlightName: name,
				highlightId: id
			}));
		},

		reset() {
			stopTimer();
			set(initialState);
		}
	};
}

export const game = createGameStore();

export const score = derived(game, ($g) =>
	$g.questions.filter((q) => q.correct === true).length
);

export const isPerfect = derived(game, ($g) =>
	$g.questions.length > 0 && $g.questions.every((q) => q.correct === true)
);

export const elapsedSeconds = derived(game, ($g) =>
	($g.timerMs / 1000).toFixed(2)
);
