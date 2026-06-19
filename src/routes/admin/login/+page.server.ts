import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const ADMIN_EMAIL = 'montserrat@opensansorroboto.com';
const ADMIN_PASSWORD = 'D3t3rm1n3d!@#$';
const SESSION_COOKIE = 'admin_session';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = (data.get('email') as string | null)?.trim().toLowerCase() ?? '';
		const password = (data.get('password') as string | null) ?? '';

		if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
			return fail(401, { error: 'Invalid email or password.' });
		}

		cookies.set(SESSION_COOKIE, ADMIN_EMAIL, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: 60 * 60 * 8 // 8 hours
		});

		throw redirect(303, '/admin/email');
	}
};
