import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	DISCORD_CLIENT_SECRET: {
		schema: optional,
		description:
			'Developer portal → OAuth2 → Client Secret. Needed for dashboard sign-in; the landing page works without it.'
	},
	DISCORD_BOT_TOKEN: {
		schema: optional,
		description: "The bot's token. The dashboard uses it to list a server's channels."
	},
	TWITCH_CLIENT_ID: {
		schema: optional,
		description: 'dev.twitch.tv → Your Console → Applications. Twitch feeds are hidden without it.'
	},
	TWITCH_CLIENT_SECRET: {
		schema: optional,
		description: "The same Twitch application's client secret."
	},
	KICK_CLIENT_ID: {
		schema: optional,
		description: 'kick.com → Settings → Developer. Kick feeds are hidden without it.'
	},
	KICK_CLIENT_SECRET: {
		schema: optional,
		description: "The same Kick application's client secret."
	},
	DISCORD_CLIENT_ID: {
		schema: optional,
		description: 'Overrides applicationId in config.yaml, like it does for the bot.'
	}
});
