import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
	const initial: Theme = browser
		? (localStorage.getItem('theme') as Theme) ?? 'light'
		: 'light';

	const { subscribe, set, update } = writable<Theme>(initial);

	if (browser) {
		document.documentElement.setAttribute('data-theme', initial);
	}

	return {
		subscribe,
		toggle() {
			update((t) => {
				const next: Theme = t === 'light' ? 'dark' : 'light';
				localStorage.setItem('theme', next);
				document.documentElement.setAttribute('data-theme', next);
				return next;
			});
		}
	};
}

export const theme = createThemeStore();
