import { and, count, desc, eq, gt, lte, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { memberXp, userXp } from './schema.ts';

export type XpStanding = {
	xp: number;
	// 1 for the most XP. People with the same XP share a place.
	rank: number;
	// Everyone with any XP in the same scope.
	total: number;
};

// Adds XP unless the last award was within the cooldown. Returns whether it was added.
// One statement, so two messages arriving together cannot both get through.
export function awardMemberXp(
	guildId: string,
	userId: string,
	amount: number,
	cooldownMs: number
): boolean {
	const now = new Date();
	const result = db
		.insert(memberXp)
		.values({ guildId, userId, xp: amount, lastAwardAt: now })
		.onConflictDoUpdate({
			target: [memberXp.guildId, memberXp.userId],
			set: { xp: sql`${memberXp.xp} + ${amount}`, lastAwardAt: now },
			setWhere: lte(memberXp.lastAwardAt, new Date(now.getTime() - cooldownMs))
		})
		.run();
	return result.changes > 0;
}

export function awardUserXp(userId: string, amount: number, cooldownMs: number): boolean {
	const now = new Date();
	const result = db
		.insert(userXp)
		.values({ userId, xp: amount, lastAwardAt: now })
		.onConflictDoUpdate({
			target: userXp.userId,
			set: { xp: sql`${userXp.xp} + ${amount}`, lastAwardAt: now },
			setWhere: lte(userXp.lastAwardAt, new Date(now.getTime() - cooldownMs))
		})
		.run();
	return result.changes > 0;
}

export function memberStanding(guildId: string, userId: string): XpStanding | null {
	const row = db
		.select({ xp: memberXp.xp })
		.from(memberXp)
		.where(and(eq(memberXp.guildId, guildId), eq(memberXp.userId, userId)))
		.get();
	if (!row) return null;
	const ahead = db
		.select({ value: count() })
		.from(memberXp)
		.where(and(eq(memberXp.guildId, guildId), gt(memberXp.xp, row.xp)))
		.get();
	const total = db
		.select({ value: count() })
		.from(memberXp)
		.where(eq(memberXp.guildId, guildId))
		.get();
	return { xp: row.xp, rank: (ahead?.value ?? 0) + 1, total: total?.value ?? 0 };
}

export function userStanding(userId: string): XpStanding | null {
	const row = db.select({ xp: userXp.xp }).from(userXp).where(eq(userXp.userId, userId)).get();
	if (!row) return null;
	const ahead = db.select({ value: count() }).from(userXp).where(gt(userXp.xp, row.xp)).get();
	const total = db.select({ value: count() }).from(userXp).get();
	return { xp: row.xp, rank: (ahead?.value ?? 0) + 1, total: total?.value ?? 0 };
}

export type Leader = { userId: string; xp: number; rank: number };

// Ranks for a page of rows already sorted by XP. People with the same XP share a place, as
// in /rank, even when a tie runs across the page boundary.
function ranked(
	rows: { userId: string; xp: number }[],
	offset: number,
	ahead: (xp: number) => number
): Leader[] {
	let rank = 0;
	return rows.map((row, index) => {
		if (index === 0) rank = ahead(row.xp) + 1;
		else if (row.xp !== rows[index - 1].xp) rank = offset + index + 1;
		return { ...row, rank };
	});
}

export function memberLeaders(guildId: string, offset: number, limit: number): Leader[] {
	const rows = db
		.select({ userId: memberXp.userId, xp: memberXp.xp })
		.from(memberXp)
		.where(eq(memberXp.guildId, guildId))
		.orderBy(desc(memberXp.xp), memberXp.userId)
		.limit(limit)
		.offset(offset)
		.all();
	return ranked(
		rows,
		offset,
		(xp) =>
			db
				.select({ value: count() })
				.from(memberXp)
				.where(and(eq(memberXp.guildId, guildId), gt(memberXp.xp, xp)))
				.get()?.value ?? 0
	);
}

export function userLeaders(offset: number, limit: number): Leader[] {
	const rows = db
		.select({ userId: userXp.userId, xp: userXp.xp })
		.from(userXp)
		.orderBy(desc(userXp.xp), userXp.userId)
		.limit(limit)
		.offset(offset)
		.all();
	return ranked(
		rows,
		offset,
		(xp) => db.select({ value: count() }).from(userXp).where(gt(userXp.xp, xp)).get()?.value ?? 0
	);
}

export function memberCount(guildId: string): number {
	return (
		db.select({ value: count() }).from(memberXp).where(eq(memberXp.guildId, guildId)).get()
			?.value ?? 0
	);
}

export function userCount(): number {
	return db.select({ value: count() }).from(userXp).get()?.value ?? 0;
}
