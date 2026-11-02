import { and, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { memberLeaves } from './schema.ts';

export function recordLeave(guildId: string, userId: string): void {
	const lastLeftAt = new Date();
	db.insert(memberLeaves)
		.values({ guildId, userId, leaves: 1, lastLeftAt })
		.onConflictDoUpdate({
			target: [memberLeaves.guildId, memberLeaves.userId],
			set: { leaves: sql`${memberLeaves.leaves} + 1`, lastLeftAt }
		})
		.run();
}

export function countLeaves(guildId: string, userId: string): number {
	return (
		db
			.select({ leaves: memberLeaves.leaves })
			.from(memberLeaves)
			.where(and(eq(memberLeaves.guildId, guildId), eq(memberLeaves.userId, userId)))
			.get()?.leaves ?? 0
	);
}
