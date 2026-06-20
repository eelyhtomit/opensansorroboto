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
	// Shareable custom game: the token of the custom_games row this run belongs
	// to (null for regular difficulties and local-only custom practice).
	shareToken: string | null;
	// Optional display name of whoever created the shared custom game.
	creatorName: string | null;
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
	highlightId: null,
	shareToken: null,
	creatorName: null
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

		// Called after questions are fetched — goes to countdown phase first.
		// For shareable custom games, pass the token (and optional creator name)
		// so the run stays bound to that game's per-token leaderboard.
		startGameWithDifficulty(
			questions: Question[],
			difficulty: Difficulty,
			fontPool: FontConfig[],
			shareToken: string | null = null,
			creatorName: string | null = null
		) {
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
				highlightId: null,
				shareToken,
				creatorName
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

		// Set / clear the shareable-custom-game token without altering phase.
		setShareToken(shareToken: string | null, creatorName: string | null = null) {
			update((s) => ({ ...s, shareToken, creatorName }));
		},

		// Hydrate the store for a shared custom game's LANDING page (no run yet):
		// makes the token, creator and font pool available (e.g. so the per-token
		// leaderboard can render) while keeping the player on a pre-game phase.
		hydrateCustomGame(
			fontPool: FontConfig[],
			shareToken: string,
			creatorName: string | null = null
		) {
			stopTimer();
			set({
				...initialState,
				difficulty: 'custom',
				fontPool,
				shareToken,
				creatorName
			});
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
