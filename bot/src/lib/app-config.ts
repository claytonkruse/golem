import { parse } from 'yaml';

// Parses config.yaml. It takes text rather than a path so the dashboard can
// import the file with Vite's ?raw instead of reading it from disk.

export type AppConfig = {
	applicationId: string;
	publicKey: string;
	invitePermissions: string;
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

export function parseAppConfig(text: string): AppConfig {
	const source: unknown = parse(text);
	if (typeof source !== 'object' || source === null) {
		throw new Error('config.yaml must be a mapping of settings.');
	}
	const settings = source as Record<string, unknown>;
	return {
		applicationId: field(settings, 'applicationId', /^\d{17,20}$/),
		publicKey: field(settings, 'publicKey', /^[0-9a-f]{64}$/),
		invitePermissions: field(settings, 'invitePermissions', /^\d+$/)
	};
}

// With guildId, Discord preselects that server and hides the server picker.
export function inviteUrl(applicationId: string, permissions: string, guildId?: string): string {
	const url = new URL('https://discord.com/oauth2/authorize');
	url.searchParams.set('client_id', applicationId);
	url.searchParams.set('scope', 'bot applications.commands');
	url.searchParams.set('permissions', permissions);
	// 0 is a server install. Golem's commands are written for servers, not user installs.
	url.searchParams.set('integration_type', '0');
	if (guildId) {
		url.searchParams.set('guild_id', guildId);
		url.searchParams.set('disable_guild_select', 'true');
	}
	return url.href;
}
