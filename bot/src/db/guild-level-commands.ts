import { eq } from 'drizzle-orm';
import { levelCommands, type LevelCommand } from '../lib/levels.ts';
import { db } from './index.ts';
import { guildLevelCommands } from './schema.ts';

// Each leveling command's own switch. A command without a row is on.
export function levelCommandSwitches(guildId: string): Record<LevelCommand, boolean> {
	const rows = db
		.select()
		.from(guildLevelCommands)
		.where(eq(guildLevelCommands.guildId, guildId))
		.all();
	const saved = new Map(rows.map((row) => [row.command, row.enabled]));
	return Object.fromEntries(
		levelCommands.map((command) => [command.key, saved.get(command.key) ?? true])
	) as Record<LevelCommand, boolean>;
}

export function setLevelCommandEnabled(
	guildId: string,
	command: LevelCommand,
	enabled: boolean
): void {
	db.insert(guildLevelCommands)
		.values({ guildId, command, enabled })
		.onConflictDoUpdate({
			target: [guildLevelCommands.guildId, guildLevelCommands.command],
			set: { enabled }
		})
		.run();
}
