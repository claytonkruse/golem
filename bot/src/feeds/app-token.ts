import { FeedError } from './fetch.ts';
import type { Credentials } from './keys.ts';

// An app access token from the client-credentials flow, which Twitch and Kick both use.
// Tokens last weeks; each is reused until a minute before it expires or an API rejects it.

type Token = { value: string; expiresAt: number };
const tokens = new Map<string, Token>();

export async function appToken(
	service: string,
	tokenUrl: string,
	credentials: Credentials,
	fresh = false
): Promise<string> {
	const cacheKey = `${service}:${credentials.clientId}`;
	const cached = tokens.get(cacheKey);
	if (cached && !fresh && cached.expiresAt > Date.now()) return cached.value;

	const response = await fetch(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: credentials.clientId,
			client_secret: credentials.clientSecret
		}),
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) {
		console.error(
			`${service} token request failed with ${response.status}.`,
			await response.text()
		);
		throw new FeedError(`Golem's ${service} keys were rejected.`);
	}
	const body = (await response.json()) as { access_token: string; expires_in: number };
	tokens.set(cacheKey, {
		value: body.access_token,
		expiresAt: Date.now() + (body.expires_in - 60) * 1000
	});
	return body.access_token;
}

// A GET that refreshes the token once if the API says it's no longer valid.
export async function apiGet<T>(
	service: string,
	tokenUrl: string,
	credentials: Credentials,
	url: string,
	headers: Record<string, string> = {}
): Promise<T> {
	for (const fresh of [false, true]) {
		const token = await appToken(service, tokenUrl, credentials, fresh);
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
			signal: AbortSignal.timeout(15_000)
		});
		if (response.status === 401 && !fresh) continue;
		if (response.status === 429) throw new FeedError(`${service} is rate limiting Golem.`);
		if (!response.ok) throw new FeedError(`${service} answered ${response.status}.`);
		return (await response.json()) as T;
	}
	throw new FeedError(`${service} rejected Golem's token.`);
}
