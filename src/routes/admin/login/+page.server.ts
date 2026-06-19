import { fail, redirect } from '@sveltejs/kit';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '$env/static/private';
import type { Actions } from './$types';

const SESSION_COOKIE = 'admin_session';

/** Constant-time string comparison to avoid leaking length/content via timing. */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = (data.get('email') as string | null)?.trim().toLowerCase() ?? '';
		const password = (data.get('password') as string | null) ?? '';

		const emailOk = safeEqual(email, ADMIN_EMAIL.toLowerCase());
		const passwordOk = safeEqual(password, ADMIN_PASSWORD);

		if (!emailOk || !passwordOk) {
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
