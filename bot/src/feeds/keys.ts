// Twitch and Kick only answer apps registered in their developer consoles. Both are free;
// without keys their feeds are hidden. The bot passes process.env, the dashboard its own
// environment.

export type Credentials = { clientId: string; clientSecret: string };
export type FeedKeys = { twitch: Credentials | null; kick: Credentials | null };

function pair(id: string | undefined, secret: string | undefined): Credentials | null {
	const clientId = id?.trim();
	const clientSecret = secret?.trim();
	return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function feedKeys(env: Record<string, string | undefined>): FeedKeys {
	return {
		twitch: pair(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET),
		kick: pair(env.KICK_CLIENT_ID, env.KICK_CLIENT_SECRET)
	};
}

// The bot's own keys. Read lazily rather than from config.ts, because the landing page
// imports every command module and config.ts exits without a bot token.
let fromEnv: FeedKeys | undefined;
export function botFeedKeys(): FeedKeys {
	fromEnv ??= feedKeys(process.env);
	return fromEnv;
}
