import { redirect } from '@sveltejs/kit';
import { deleteSession } from '#bot/db/sessions.ts';
import { forgetGuilds, revokeToken } from '#lib/server/discord.js';
import { clearSessionCookie, SESSION_COOKIE } from '#lib/server/session-cookie.js';
import type { RequestHandler } from './$types';

// Endpoints do not inherit trailingSlash from +layout.server.ts.
export const trailingSlash = 'always';

// POST only, so a link or an image on another site cannot sign someone out.
export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(token);
	clearSessionCookie(cookies);

	if (locals.session) {
		forgetGuilds(locals.session.accessToken);
		await revokeToken(locals.session.accessToken);
	}

	redirect(303, '/');
};
