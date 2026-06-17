import { register, init, getLocaleFromNavigator } from 'svelte-i18n';

register('en', () => import('./en.json'));
register('ja', () => import('./ja.json'));
register('zh', () => import('./zh.json'));
register('es', () => import('./es.json'));
register('fr', () => import('./fr.json'));
register('pt', () => import('./pt.json'));

export function setupI18n() {
	init({
		fallbackLocale: 'en',
		initialLocale: getLocaleFromNavigator() ?? 'en'
	});
}
