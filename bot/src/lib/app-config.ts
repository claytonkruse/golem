import {
	ApplicationIntegrationType,
	OAuth2Routes,
	OAuth2Scopes,
	PermissionFlagsBits,
	PermissionsBitField,
	type PermissionsString
} from 'discord.js';
import { parse } from 'yaml';

// Parses config.yaml. It takes text rather than a path so the dashboard can
// import the file with Vite's ?raw instead of reading it from disk.

export type AppConfig = {
	applicationId: string;
	publicKey: string;
	invitePermissions: PermissionsString[];
};

function field(source: Record<string, unknown>, name: string, pattern: RegExp): string {
	const value = source[name];
	if (typeof value !== 'string') {
		throw new Error(`config.yaml: ${name} must be a quoted string.`);
	}
	if (!pattern.test(value)) {
		throw new Error(`config.yaml: ${name} is not valid (${value}).`);
	}
	return value;
}

// Permission names as discord.js spells them, like ViewChannel, so a typo fails at startup.
function permissions(source: Record<string, unknown>, name: string): PermissionsString[] {
	const value = source[name] ?? [];
	if (!Array.isArray(value)) throw new Error(`config.yaml: ${name} must be a list.`);
	return value.map((permission: unknown) => {
		if (typeof permission !== 'string' || !Object.hasOwn(PermissionFlagsBits, permission)) {
			throw new Error(`config.yaml: ${String(permission)} in ${name} is not a permission.`);
		}
		return permission as PermissionsString;
	});
}

export function parseAppConfig(text: string): AppConfig {
	const source: unknown = parse(text);
	if (typeof source !== 'object' || source === null) {
		throw new Error('config.yaml must be a mapping of settings.');
	}
	const settings = source as Record<string, unknown>;
	return {
		applicationId: field(settings, 'applicationId', /^\d{17,20}$/),
		publicKey: field(settings, 'publicKey', /^[0-9a-f]{64}$/),
		invitePermissions: permissions(settings, 'invitePermissions')
	};
}

// With guildId, Discord preselects that server and hides the server picker. Built from
// discord.js's constants rather than Client#generateInvite, which needs a logged-in client
// that the dashboard doesn't have and can't ask for a server install.
export function inviteUrl(
	applicationId: string,
	permissions: PermissionsString[],
	guildId?: string
): string {
	const url = new URL(OAuth2Routes.authorizationURL);
	url.searchParams.set('client_id', applicationId);
	url.searchParams.set('scope', [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands].join(' '));
	url.searchParams.set('permissions', new PermissionsBitField(permissions).bitfield.toString());
	// Golem's commands are written for servers, not user installs.
	url.searchParams.set('integration_type', String(ApplicationIntegrationType.GuildInstall));
	if (guildId) {
		url.searchParams.set('guild_id', guildId);
		url.searchParams.set('disable_guild_select', 'true');
	}
	return url.href;
}
