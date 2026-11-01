import { error, redirect } from '@sveltejs/kit';
import { createSession } from '#bot/db/sessions.ts';
import { exchangeCode, fetchUser } from '#lib/server/discord.js';
import { setSessionCookie } from '#lib/server/session-cookie.js';
import type { RequestHandler } from './$types';

// Endpoints do not inherit trailingSlash from +layout.server.ts.
export const trailingSlash = 'always';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const expected = cookies.get('golem_oauth_state');
	cookies.delete('golem_oauth_state', { path: '/auth/' });

	// The person pressed Cancel on Discord's screen.
	if (url.searchParams.get('error') === 'access_denied') redirect(303, '/');

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state || !expected || state !== expected) {
		error(400, 'That sign-in link expired or was not started here. Try signing in again.');
	}

	const redirectUri = new URL('/auth/callback/', url).href;
	const token = await exchangeCode(code, redirectUri);
	const user = await fetchUser(token.access_token);
	const expiresAt = new Date(Date.now() + token.expires_in * 1000);

	const sessionToken = createSession({
		userId: user.id,
		username: user.username,
		globalName: user.global_name,
		avatar: user.avatar,
		accessToken: token.access_token,
		expiresAt
	});
	setSessionCookie(cookies, sessionToken, expiresAt);

	redirect(303, '/dashboard/');
};
