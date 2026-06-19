import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const SESSION_COOKIE = 'admin_session';
const SESSION_VALUE = 'montserrat@opensansorroboto.com';

export const load: LayoutServerLoad = ({ cookies, url }) => {
	const isLoginPage = url.pathname === '/admin/login';
	const session = cookies.get(SESSION_COOKIE);

	if (!isLoginPage && session !== SESSION_VALUE) {
		throw redirect(303, '/admin/login');
	}

	if (isLoginPage && session === SESSION_VALUE) {
		throw redirect(303, '/admin/email');
	}

	return {};
};
