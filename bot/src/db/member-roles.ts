import { and, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { memberRoles } from './schema.ts';

export type Removal = (typeof memberRoles.$inferSelect)['removal'];
export type SavedRoles = { roleIds: string[]; removal: Removal };

export function saveRoles(guildId: string, userId: string, saved: SavedRoles): void {
	const leftAt = new Date();
	db.insert(memberRoles)
		.values({ guildId, userId, ...saved, leftAt })
		.onConflictDoUpdate({
			target: [memberRoles.guildId, memberRoles.userId],
			set: { ...saved, leftAt }
		})
		.run();
}

// Returns what was saved when this member left and forgets it, so roles are restored once.
export function takeRoles(guildId: string, userId: string): SavedRoles | null {
	const where = and(eq(memberRoles.guildId, guildId), eq(memberRoles.userId, userId));
	const row = db
		.select({ roleIds: memberRoles.roleIds, removal: memberRoles.removal })
		.from(memberRoles)
		.where(where)
		.get();
	if (row) db.delete(memberRoles).where(where).run();
	return row ?? null;
}

export function forgetGuildRoles(guildId: string): void {
	db.delete(memberRoles).where(eq(memberRoles.guildId, guildId)).run();
}
