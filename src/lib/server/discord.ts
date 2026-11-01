import { error } from '@sveltejs/kit';
import { clientId, clientSecret } from './config.ts';

const API = 'https://discord.com/api/v10';
const CDN = 'https://cdn.discordapp.com';

// identify for the user's name and avatar, guilds for the servers they are in.
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

// Discord answered 401: the person revoked Golem in their settings or the token expired.
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
// each session's list is reused for a minute.
const GUILD_CACHE_MS = 60_000;
const guildCache = new Map<string, { at: number; guilds: DiscordGuild[] }>();

export async function fetchGuilds(accessToken: string): Promise<DiscordGuild[]> {
	const cached = guildCache.get(accessToken);
	if (cached && Date.now() - cached.at < GUILD_CACHE_MS) return cached.guilds;

	const response = await fetch(`${API}/users/@me/guilds`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	const guilds = await discordJson<DiscordGuild[]>(response, 'list your servers');

	for (const [token, entry] of guildCache) {
		if (Date.now() - entry.at >= GUILD_CACHE_MS) guildCache.delete(token);
	}
	guildCache.set(accessToken, { at: Date.now(), guilds });
	return guilds;
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
