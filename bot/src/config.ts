import { readFileSync } from 'node:fs';
import { parseAppConfig } from './lib/app-config.ts';

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
		process.exit(1);
	}
	return value;
}

const file = parseAppConfig(readFileSync(new URL('../../config.yaml', import.meta.url), 'utf8'));

export const config = {
	token: required('DISCORD_BOT_TOKEN'),
	clientId: process.env.DISCORD_CLIENT_ID?.trim() || file.applicationId,
	publicKey: file.publicKey,
	invitePermissions: file.invitePermissions,
	guildId: process.env.DISCORD_GUILD_ID?.trim() || undefined
};
