import { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from '$app/env/private';
import configText from '../../../config.yaml?raw';
import { inviteUrl, parseAppConfig } from '#bot/lib/app-config.ts';

const file = parseAppConfig(configText);

// Same override as the bot, so a local run can point at a development application.
export const clientId = DISCORD_CLIENT_ID ?? file.applicationId;

export function invite(guildId?: string): string {
	return inviteUrl(clientId, file.invitePermissions, guildId);
}

export const asksForPermissions = file.invitePermissions.length > 0;

export function botToken(): string {
	if (!DISCORD_BOT_TOKEN) {
		throw new Error('Missing DISCORD_BOT_TOKEN. The dashboard needs it to list channels.');
	}
	return DISCORD_BOT_TOKEN;
}

export function clientSecret(): string {
	if (!DISCORD_CLIENT_SECRET) {
		throw new Error('Missing DISCORD_CLIENT_SECRET. Copy it from the developer portal into .env.');
	}
	return DISCORD_CLIENT_SECRET;
}
