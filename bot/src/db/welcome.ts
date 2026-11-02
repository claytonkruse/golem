import { eq } from 'drizzle-orm';
import { DEFAULT_WELCOME_MESSAGE, usesInviteVariables } from '../lib/welcome.ts';
import { db } from './index.ts';
import { welcomeSettings } from './schema.ts';

export type WelcomeSettings = Omit<typeof welcomeSettings.$inferSelect, 'guildId'>;

const defaults: WelcomeSettings = {
	enabled: false,
	channelId: null,
	message: DEFAULT_WELCOME_MESSAGE
};

export function getWelcome(guildId: string): WelcomeSettings {
	const row = db.select().from(welcomeSettings).where(eq(welcomeSettings.guildId, guildId)).get();
	return row ? { enabled: row.enabled, channelId: row.channelId, message: row.message } : defaults;
}

export function updateWelcome(guildId: string, changes: Partial<WelcomeSettings>): void {
	db.insert(welcomeSettings)
		.values({ ...defaults, ...changes, guildId })
		.onConflictDoUpdate({ target: welcomeSettings.guildId, set: changes })
		.run();
}

// Whether this server's welcome message needs to know which invite someone used.
export function welcomeUsesInvites(guildId: string): boolean {
	const welcome = getWelcome(guildId);
	return welcome.enabled && usesInviteVariables(welcome.message);
}

// Servers whose welcome message needs invites, so the bot can start tracking them.
export function guildsWithWelcomeInvites(): string[] {
	return db
		.select()
		.from(welcomeSettings)
		.where(eq(welcomeSettings.enabled, true))
		.all()
		.filter((row) => usesInviteVariables(row.message))
		.map((row) => row.guildId);
}
