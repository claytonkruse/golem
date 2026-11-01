import type { Handle } from '@sveltejs/kit/hooks';
import { deleteExpiredSessions, findSession } from '#bot/db/sessions.ts';
import { avatarUrl } from '#lib/server/discord.js';
import { clearSessionCookie, SESSION_COOKIE } from '#lib/server/session-cookie.js';

// Expired sessions are also dropped when they are next used. This catches the ones
// nobody comes back to.
deleteExpiredSessions();
setInterval(deleteExpiredSessions, 60 * 60 * 1000).unref();

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const session = token ? findSession(token) : undefined;

	if (token && !session) clearSessionCookie(event.cookies);

	event.locals.session = session ?? null;
	event.locals.user = session
		? {
				id: session.userId,
				name: session.globalName ?? session.username,
				avatarUrl: avatarUrl({ id: session.userId, avatar: session.avatar })
			}
		: null;

	return resolve(event);
};
