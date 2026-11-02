import { eq } from 'drizzle-orm';
import { games, type GameKey } from '../lib/games.ts';
import { getGuildSettings } from './guild-settings.ts';
import { db } from './index.ts';
import { guildGames } from './schema.ts';

// Each game's own switch. A game without a row is on.
export function gameSwitches(guildId: string): Record<GameKey, boolean> {
	const rows = db.select().from(guildGames).where(eq(guildGames.guildId, guildId)).all();
	const saved = new Map(rows.map((row) => [row.game, row.enabled]));
	return Object.fromEntries(games.map((game) => [game.key, saved.get(game.key) ?? true])) as Record<
		GameKey,
		boolean
	>;
}

export function setGameEnabled(guildId: string, game: GameKey, enabled: boolean): void {
	db.insert(guildGames)
		.values({ guildId, game, enabled })
		.onConflictDoUpdate({ target: [guildGames.guildId, guildGames.game], set: { enabled } })
		.run();
}

// Why a game can't be started here, or null when it can. DMs belong to no server, so
// games are always allowed there.
export function gameBlocked(guildId: string | null, game: GameKey): string | null {
	if (!guildId) return null;
	if (!getGuildSettings(guildId).gamesEnabled) {
		return 'Games are turned off in this server. A server manager can turn them on in the dashboard.';
	}
	if (!gameSwitches(guildId)[game]) {
		const label = games.find((entry) => entry.key === game)?.label ?? game;
		return `${label} is turned off in this server.`;
	}
	return null;
}
