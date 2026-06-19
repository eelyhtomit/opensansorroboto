import { redirect } from '@sveltejs/kit';
import { ADMIN_EMAIL } from '$env/static/private';
import type { LayoutServerLoad } from './$types';

const SESSION_COOKIE = 'admin_session';

export const load: LayoutServerLoad = ({ cookies, url }) => {
	const isLoginPage = url.pathname === '/admin/login';
	const session = cookies.get(SESSION_COOKIE);
	const authed = session === ADMIN_EMAIL;

	if (!isLoginPage && !authed) {
		throw redirect(303, '/admin/login');
	}

	if (isLoginPage && authed) {
		throw redirect(303, '/admin/email');
	}

	return {};
};
