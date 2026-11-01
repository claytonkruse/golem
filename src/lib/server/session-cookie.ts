import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'golem_session';

export function setSessionCookie(cookies: Cookies, token: string, expires: Date): void {
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires });
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
