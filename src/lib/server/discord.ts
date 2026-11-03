import { error } from '@sveltejs/kit';
import { botToken, clientId, clientSecret } from './config.ts';

const API = 'https://discord.com/api/v10';
const CDN = 'https://cdn.discordapp.com';

// identify for the user's name and avatar, guilds for the servers the user is in.
const SCOPES = 'identify guilds';

// Permission bits from https://discord.com/developers/docs/topics/permissions
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

export type DiscordUser = {
	id: string;
	username: string;
	global_name: string | null;
	avatar: string | null;
};

export type DiscordGuild = {
	id: string;
	name: string;
	icon: string | null;
	owner: boolean;
	permissions: string;
};

// Discord answered 401: the person revoked Golem in Discord's settings or the token expired.
export class DiscordUnauthorized extends Error {}

type TokenResponse = {
	access_token: string;
	expires_in: number;
};

export function authorizeUrl(redirectUri: string, state: string): string {
	const url = new URL('https://discord.com/oauth2/authorize');
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', SCOPES);
	url.searchParams.set('redirect_uri', redirectUri);
	url.searchParams.set('state', state);
	// Skips the consent screen for people who already approved these scopes.
	url.searchParams.set('prompt', 'none');
	return url.href;
}

function basicAuth(): string {
	return `Basic ${Buffer.from(`${clientId}:${clientSecret()}`).toString('base64')}`;
}

// Discord's 429s say how long to wait. Short waits are cheaper to sit out than to fail the
// page over, so one retry is made when the wait is a few seconds at most.
const MAX_RETRY_WAIT_MS = 5_000;

async function discordFetch(url: string, init: RequestInit): Promise<Response> {
	const response = await fetch(url, init);
	if (response.status !== 429) return response;
	const body = (await response
		.clone()
		.json()
		.catch(() => null)) as { retry_after?: number } | null;
	const waitMs = (body?.retry_after ?? Number(response.headers.get('retry-after'))) * 1000;
	if (!(waitMs >= 0 && waitMs <= MAX_RETRY_WAIT_MS)) return response;
	await new Promise((resolve) => setTimeout(resolve, waitMs));
	return fetch(url, init);
}

async function discordJson<T>(response: Response, what: string): Promise<T> {
	if (response.status === 401)
		throw new DiscordUnauthorized(`Discord rejected the token to ${what}.`);
	if (response.status === 429) {
		error(503, 'Discord is rate limiting Golem. Try again in a few seconds.');
	}
	if (!response.ok) {
		console.error(`Discord ${what} failed with ${response.status}.`, await response.text());
		error(502, `Discord could not ${what}.`);
	}
	return (await response.json()) as T;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
	const response = await fetch(`${API}/oauth2/token`, {
		method: 'POST',
		headers: {
			Authorization: basicAuth(),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});
	return discordJson<TokenResponse>(response, 'finish signing you in');
}

// Best effort: the session is already gone locally, so a failure here only means the
// token lives until it expires.
export async function revokeToken(token: string): Promise<void> {
	try {
		await fetch(`${API}/oauth2/token/revoke`, {
			method: 'POST',
			headers: {
				Authorization: basicAuth(),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({ token, token_type_hint: 'access_token' })
		});
	} catch (cause) {
		console.error('Could not revoke a Discord token.', cause);
	}
}

export async function fetchUser(accessToken: string): Promise<DiscordUser> {
	const response = await fetch(`${API}/users/@me`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	return discordJson<DiscordUser>(response, 'load your profile');
}

// Discord rate limits this endpoint per user, and every dashboard page needs it, so
// each session's list is reused for a minute. SvelteKit runs a page's loads in parallel,
// so the request itself is shared too: otherwise the layouts and the page each miss the
// cache at once and the second or third call gets a 429.
const GUILD_CACHE_MS = 60_000;
type GuildEntry = { at: number; guilds: Promise<DiscordGuild[]>; last?: DiscordGuild[] };
const guildCache = new Map<string, GuildEntry>();

export async function fetchGuilds(accessToken: string): Promise<DiscordGuild[]> {
	const cached = guildCache.get(accessToken);
	if (cached && Date.now() - cached.at < GUILD_CACHE_MS) return cached.guilds;

	for (const [token, entry] of guildCache) {
		if (Date.now() - entry.at >= GUILD_CACHE_MS * 10) guildCache.delete(token);
	}
	const entry: GuildEntry = { at: Date.now(), guilds: loadGuilds(accessToken), last: cached?.last };
	guildCache.set(accessToken, entry);
	try {
		entry.last = await entry.guilds;
		return entry.last;
	} catch (cause) {
		// A failed request isn't cached, so the next page load tries again. While Discord is
		// rate limiting, a list from the last few minutes is better than an error page.
		if (guildCache.get(accessToken) === entry) {
			if (entry.last)
				guildCache.set(accessToken, { ...entry, guilds: Promise.resolve(entry.last) });
			else guildCache.delete(accessToken);
		}
		if (entry.last && !(cause instanceof DiscordUnauthorized)) return entry.last;
		throw cause;
	}
}

async function loadGuilds(accessToken: string): Promise<DiscordGuild[]> {
	const response = await discordFetch(`${API}/users/@me/guilds`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	return discordJson<DiscordGuild[]>(response, 'list your servers');
}

export type DiscordChannel = {
	id: string;
	name: string;
	type: number;
	position: number;
	parent_id: string | null;
};

// Golem's view of a server's channels. Short cache: it only saves repeat requests while
// someone is clicking through the settings. Shared while in flight, like the server list.
const CHANNEL_CACHE_MS = 15_000;
const channelCache = new Map<string, { at: number; channels: Promise<DiscordChannel[]> }>();

export async function fetchGuildChannels(guildId: string): Promise<DiscordChannel[]> {
	const cached = channelCache.get(guildId);
	if (cached && Date.now() - cached.at < CHANNEL_CACHE_MS) return cached.channels;

	for (const [id, entry] of channelCache) {
		if (Date.now() - entry.at >= CHANNEL_CACHE_MS) channelCache.delete(id);
	}
	const entry = { at: Date.now(), channels: loadChannels(guildId) };
	channelCache.set(guildId, entry);
	try {
		return await entry.channels;
	} catch (cause) {
		if (channelCache.get(guildId) === entry) channelCache.delete(guildId);
		throw cause;
	}
}

async function loadChannels(guildId: string): Promise<DiscordChannel[]> {
	const response = await discordFetch(`${API}/guilds/${guildId}/channels`, {
		headers: { Authorization: `Bot ${botToken()}` }
	});
	// 401 here means the bot token is wrong, not that the person's session ended.
	if (response.status === 401) error(500, 'The dashboard has the wrong bot token.');
	return discordJson<DiscordChannel[]>(response, "list this server's channels");
}

export function forgetGuilds(accessToken: string): void {
	guildCache.delete(accessToken);
}

// Discord shows the same check: owners, administrators and Manage Server can configure apps.
export function canManage(guild: DiscordGuild): boolean {
	const permissions = BigInt(guild.permissions);
	return guild.owner || (permissions & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
}

export function avatarUrl(user: { id: string; avatar: string | null }): string {
	if (user.avatar) return `${CDN}/avatars/${user.id}/${user.avatar}.png?size=64`;
	// Discord's default avatars are picked from the id for accounts without one.
	return `${CDN}/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

export function guildIconUrl(guild: DiscordGuild): string | null {
	return guild.icon ? `${CDN}/icons/${guild.id}/${guild.icon}.png?size=96` : null;
}

export type DiscordInvite = {
	code: string;
	uses: number;
	// Missing for invites made by Discord itself, like a widget's.
	inviter?: DiscordUser;
};

// A server's invite links with their all-time uses, or null when Golem lacks Manage Server,
// which Discord requires to list them.
export async function fetchGuildInvites(guildId: string): Promise<DiscordInvite[] | null> {
	const response = await discordFetch(`${API}/guilds/${guildId}/invites`, {
		headers: { Authorization: `Bot ${botToken()}` }
	});
	if (response.status === 401) error(500, 'The dashboard has the wrong bot token.');
	if (response.status === 403) return null;
	return discordJson<DiscordInvite[]>(response, "list this server's invites");
}

// Names change rarely, so users are cached for a while across page loads.
const USER_CACHE_MS = 10 * 60 * 1000;
const userCache = new Map<string, { at: number; user: Promise<DiscordUser | null> }>();

async function loadUser(userId: string): Promise<DiscordUser | null> {
	const response = await discordFetch(`${API}/users/${userId}`, {
		headers: { Authorization: `Bot ${botToken()}` }
	});
	// A deleted account, or one Discord won't show; the page falls back to the id.
	if (!response.ok) return null;
	return (await response.json()) as DiscordUser;
}

export async function fetchUsers(userIds: string[]): Promise<Map<string, DiscordUser>> {
	for (const [id, entry] of userCache) {
		if (Date.now() - entry.at >= USER_CACHE_MS) userCache.delete(id);
	}
	const users = await Promise.all(
		userIds.map((id) => {
			let entry = userCache.get(id);
			if (!entry) {
				entry = { at: Date.now(), user: loadUser(id) };
				userCache.set(id, entry);
			}
			return entry.user;
		})
	);
	return new Map(users.filter((user) => user !== null).map((user) => [user.id, user]));
}

export type DiscordRole = {
	id: string;
	name: string;
	color: number;
	position: number;
	permissions: string;
	managed: boolean;
};

const MANAGE_ROLES = 1n << 28n;

export type RoleOption = {
	id: string;
	name: string;
	color: number;
	// Why Golem can't give this role, or null if it can.
	blocked: string | null;
};

// The roles Golem could give, highest first, with the ones it can't marked, plus whether it
// has Manage Roles at all. @everyone is left out.
export async function fetchRoleOptions(
	guildId: string
): Promise<{ roles: RoleOption[]; canManageRoles: boolean }> {
	const headers = { Authorization: `Bot ${botToken()}` };
	const [rolesResponse, meResponse] = await Promise.all([
		discordFetch(`${API}/guilds/${guildId}/roles`, { headers }),
		discordFetch(`${API}/guilds/${guildId}/members/${clientId}`, { headers })
	]);
	if (rolesResponse.status === 401) error(500, 'The dashboard has the wrong bot token.');
	const roles = await discordJson<DiscordRole[]>(rolesResponse, "list this server's roles");
	const me = await discordJson<{ roles: string[] }>(meResponse, 'look up Golem in this server');

	const everyone = roles.find((role) => role.id === guildId);
	const mine = roles.filter((role) => me.roles.includes(role.id));
	const permissions = [everyone, ...mine].reduce(
		(all, role) => all | BigInt(role?.permissions ?? '0'),
		0n
	);
	const canManageRoles = (permissions & (ADMINISTRATOR | MANAGE_ROLES)) !== 0n;
	const top = Math.max(0, ...mine.map((role) => role.position));

	return {
		canManageRoles,
		roles: roles
			.filter((role) => role.id !== guildId)
			.sort((a, b) => b.position - a.position)
			.map((role) => ({
				id: role.id,
				name: role.name,
				color: role.color,
				blocked: role.managed
					? 'Belongs to an app or boosting'
					: role.position >= top
						? "Above Golem's highest role"
						: null
			}))
	};
}
