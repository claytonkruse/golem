import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	DISCORD_CLIENT_SECRET: {
		schema: optional,
		description:
			'Developer portal → OAuth2 → Client Secret. Needed for dashboard sign-in; the landing page works without it.'
	},
	DISCORD_CLIENT_ID: {
		schema: optional,
		description: 'Overrides applicationId in config.yaml, like it does for the bot.'
	}
});
