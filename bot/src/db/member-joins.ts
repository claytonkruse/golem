import { and, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { memberJoins } from './schema.ts';

export function recordJoin(guildId: string, userId: string, joinedAt: Date): void {
	db.insert(memberJoins)
		.values({ guildId, userId, joinedAt })
		.onConflictDoUpdate({ target: [memberJoins.guildId, memberJoins.userId], set: { joinedAt } })
		.run();
}

// Returns when this member joined and forgets it, since the member is leaving.
export function takeJoin(guildId: string, userId: string): Date | null {
	const where = and(eq(memberJoins.guildId, guildId), eq(memberJoins.userId, userId));
	const row = db.select({ joinedAt: memberJoins.joinedAt }).from(memberJoins).where(where).get();
	if (row) db.delete(memberJoins).where(where).run();
	return row?.joinedAt ?? null;
}
