import { apiGet } from './app-token.ts';
import type { Credentials } from './keys.ts';

// https://dev.twitch.tv/docs/api/reference

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const API = 'https://api.twitch.tv/helix';

export type TwitchUser = { id: string; login: string; display_name: string };

export type TwitchStream = {
	id: string;
	user_login: string;
	user_name: string;
	game_name: string;
	title: string;
	started_at: string;
	thumbnail_url: string;
};

function helix<T>(credentials: Credentials, path: string) {
	return apiGet<{ data: T[] }>('Twitch', TOKEN_URL, credentials, `${API}${path}`, {
		'Client-Id': credentials.clientId
	});
}

export async function twitchUser(credentials: Credentials, login: string) {
	const { data } = await helix<TwitchUser>(
		credentials,
		`/users?login=${encodeURIComponent(login)}`
	);
	return data[0] ?? null;
}

export async function twitchStream(credentials: Credentials, userId: string) {
	const { data } = await helix<TwitchStream>(
		credentials,
		`/streams?user_id=${encodeURIComponent(userId)}`
	);
	return data.find((stream) => stream.id) ?? null;
}
