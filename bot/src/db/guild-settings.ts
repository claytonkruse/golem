import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { guildSettings } from './schema.ts';

export type GuildSettings = Omit<typeof guildSettings.$inferSelect, 'guildId'>;

const defaults: GuildSettings = {
	commandXp: true,
	levelCommands: false,
	gamesEnabled: false,
	restoreRoles: false,
	restoreKicked: false,
	restoreBanned: false
};

export function getGuildSettings(guildId: string): GuildSettings {
	const row = db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).get();
	return row
		? {
				commandXp: row.commandXp,
				levelCommands: row.levelCommands,
				gamesEnabled: row.gamesEnabled,
				restoreRoles: row.restoreRoles,
				restoreKicked: row.restoreKicked,
				restoreBanned: row.restoreBanned
			}
		: defaults;
}

export function updateGuildSettings(guildId: string, changes: Partial<GuildSettings>): void {
	db.insert(guildSettings)
		.values({ ...defaults, ...changes, guildId })
		.onConflictDoUpdate({ target: guildSettings.guildId, set: changes })
		.run();
}

// Servers that restore roles on rejoin, so the bot can load their members' roles.
export function guildsRestoringRoles(): string[] {
	return db
		.select({ guildId: guildSettings.guildId })
		.from(guildSettings)
		.where(eq(guildSettings.restoreRoles, true))
		.all()
		.map((row) => row.guildId);
}
