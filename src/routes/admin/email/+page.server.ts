import { fail, redirect } from '@sveltejs/kit';
import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

const resend = new Resend(RESEND_API_KEY);
const FROM = 'Montserrat <montserrat@opensansorroboto.com>';
const SESSION_COOKIE = 'admin_session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
	send: async ({ request }) => {
		const data = await request.formData();
		const to = (data.get('to') as string | null)?.trim() ?? '';
		const subject = (data.get('subject') as string | null)?.trim() ?? '';
		const body = (data.get('body') as string | null)?.trim() ?? '';

		if (!to || !EMAIL_RE.test(to)) {
			return fail(400, { error: 'Please enter a valid recipient email address.', to, subject, body });
		}
		if (!subject) {
			return fail(400, { error: 'Subject is required.', to, subject, body });
		}
		if (!body) {
			return fail(400, { error: 'Body is required.', to, subject, body });
		}

		// Escape HTML so plain-text body renders safely in an HTML email
		const escaped = body
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/\n/g, '<br>');

		const html = `<div style="max-width:600px;color:#111;line-height:1.6">${escaped}</div>`;

		const result = await resend.emails.send({
			from: FROM,
			to,
			subject,
			html,
			text: body
		});

		if (result.error) {
			console.error('Resend error:', result.error);
			return fail(502, { error: `Failed to send: ${result.error.message}`, to, subject, body });
		}

		return { success: true, messageId: result.data?.id };
	},

	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		throw redirect(303, '/admin/login');
	}
};
