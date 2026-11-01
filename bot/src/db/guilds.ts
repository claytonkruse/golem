import { count, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { guilds } from './schema.ts';

export type GuildRecord = typeof guilds.$inferInsert;

// Two parameters per row keeps each insert well under SQLite's variable limit.
const CHUNK = 500;

export function addGuilds(records: GuildRecord[]): void {
	db.transaction((tx) => {
		for (let start = 0; start < records.length; start += CHUNK) {
			tx.insert(guilds)
				.values(records.slice(start, start + CHUNK))
				.onConflictDoUpdate({ target: guilds.id, set: { joinedAt: sql`excluded.joined_at` } })
				.run();
		}
	});
}

export function removeGuild(id: string): void {
	db.delete(guilds).where(eq(guilds.id, id)).run();
}

export function countGuilds(): number {
	return db.select({ value: count() }).from(guilds).get()?.value ?? 0;
}

// Which of these servers Golem is in, with when it joined each one.
export function findGuilds(ids: string[]): Map<string, Date> {
	const found = new Map<string, Date>();
	for (let start = 0; start < ids.length; start += CHUNK) {
		const rows = db
			.select()
			.from(guilds)
			.where(inArray(guilds.id, ids.slice(start, start + CHUNK)))
			.all();
		for (const row of rows) found.set(row.id, row.joinedAt);
	}
	return found;
}
