import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { guildSettings } from './schema.ts';

export type GuildSettings = Omit<typeof guildSettings.$inferSelect, 'guildId'>;

const defaults: GuildSettings = { commandXp: true, levelCommands: false, gamesEnabled: false };

export function getGuildSettings(guildId: string): GuildSettings {
	const row = db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).get();
	return row
		? { commandXp: row.commandXp, levelCommands: row.levelCommands, gamesEnabled: row.gamesEnabled }
		: defaults;
}

export function updateGuildSettings(guildId: string, changes: Partial<GuildSettings>): void {
	db.insert(guildSettings)
		.values({ ...defaults, ...changes, guildId })
		.onConflictDoUpdate({ target: guildSettings.guildId, set: changes })
		.run();
}
