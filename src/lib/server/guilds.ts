import { error, redirect, type Cookies } from '@sveltejs/kit';
import { findGuilds } from '#bot/db/guilds.ts';
import { deleteSession } from '#bot/db/sessions.ts';
import { requireSession } from './auth.js';
import { invite } from './config.js';
import {
	canManage,
	DiscordUnauthorized,
	fetchGuilds,
	guildIconUrl,
	type DiscordGuild
} from './discord.js';
import { clearSessionCookie, SESSION_COOKIE } from './session-cookie.js';

export type ManagedGuild = {
	id: string;
	name: string;
	iconUrl: string | null;
	// When Golem joined, or null if it is not in the server.
	joinedAt: string | null;
	invite: string;
};

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

type SessionEvent = { locals: App.Locals; cookies: Cookies };

async function userGuilds({ locals, cookies }: SessionEvent): Promise<DiscordGuild[]> {
	const session = requireSession(locals);
	try {
		return await fetchGuilds(session.accessToken);
	} catch (cause) {
		if (!(cause instanceof DiscordUnauthorized)) throw cause;
		// The session is useless without a working token. Ending it here keeps the login
		// route from bouncing straight back to the dashboard.
		const token = cookies.get(SESSION_COOKIE);
		if (token) deleteSession(token);
		clearSessionCookie(cookies);
		redirect(303, '/auth/login/');
	}
}

// The servers this person can configure, with Golem's servers first.
export async function managedGuilds(event: SessionEvent): Promise<ManagedGuild[]> {
	const guilds = (await userGuilds(event)).filter(canManage);
	const joined = findGuilds(guilds.map((guild) => guild.id));

	return guilds
		.map((guild) => {
			const joinedAt = joined.get(guild.id);
			return {
				id: guild.id,
				name: guild.name,
				iconUrl: guildIconUrl(guild),
				joinedAt: joinedAt ? dateFormat.format(joinedAt) : null,
				invite: invite(guild.id)
			};
		})
		.sort(
			(a, b) =>
				Number(b.joinedAt !== null) - Number(a.joinedAt !== null) || a.name.localeCompare(b.name)
		);
}

// 404 rather than 403 for servers the person cannot manage, so the dashboard does not
// reveal which server ids exist or have Golem.
export async function managedGuild(event: SessionEvent, id: string): Promise<ManagedGuild> {
	const guild = (await managedGuilds(event)).find((entry) => entry.id === id);
	if (!guild) error(404, 'Server not found');
	return guild;
}
