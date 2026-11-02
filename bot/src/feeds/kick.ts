import { apiGet } from './app-token.ts';
import type { Credentials } from './keys.ts';

// https://docs.kick.com — the public API.

const TOKEN_URL = 'https://id.kick.com/oauth/token';
const API = 'https://api.kick.com/public/v1';

export type KickChannel = {
	broadcaster_user_id: number;
	slug: string;
	stream_title?: string;
	category?: { name?: string } | null;
	stream?: {
		is_live?: boolean;
		start_time?: string;
		thumbnail?: string;
	} | null;
};

async function channels(credentials: Credentials, query: string) {
	const { data } = await apiGet<{ data: KickChannel[] }>(
		'Kick',
		TOKEN_URL,
		credentials,
		`${API}/channels?${query}`
	);
	return data[0] ?? null;
}

export function kickChannelBySlug(credentials: Credentials, slug: string) {
	return channels(credentials, `slug=${encodeURIComponent(slug)}`);
}

export function kickChannelById(credentials: Credentials, id: string) {
	return channels(credentials, `broadcaster_user_id=${encodeURIComponent(id)}`);
}

// Kick has no stream id, so a stream is known by when it started.
export function kickLiveSession(channel: KickChannel): string | null {
	return channel.stream?.is_live ? (channel.stream.start_time ?? 'live') : null;
}
