import { redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { authorizeUrl } from '#lib/server/discord.js';
import type { RequestHandler } from './$types';

// Endpoints do not inherit trailingSlash from +layout.server.ts.
export const trailingSlash = 'always';

export const GET: RequestHandler = ({ cookies, locals, url }) => {
	if (locals.user) redirect(303, '/dashboard/');

	// Ties the callback to this browser so another site cannot finish a sign-in for it.
	const state = randomBytes(16).toString('base64url');
	cookies.set('golem_oauth_state', state, {
		path: '/auth/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600
	});

	redirect(303, authorizeUrl(new URL('/auth/callback/', url).href, state), {
		external: ['https://discord.com']
	});
};
