import { and, eq, gte, sql } from 'drizzle-orm';
import { DAILY_CHIPS, DAILY_COOLDOWN_MS, STARTING_CHIPS } from '../lib/chips.ts';
import { db } from './index.ts';
import { chipBalances, chipHolds } from './schema.ts';

// Gives a first-time player their starting chips. Safe to call every time.
function ensureBalance(userId: string): void {
	db.insert(chipBalances).values({ userId, chips: STARTING_CHIPS }).onConflictDoNothing().run();
}

export function getBalance(userId: string): number {
	ensureBalance(userId);
	return db.select().from(chipBalances).where(eq(chipBalances.userId, userId)).get()?.chips ?? 0;
}

// Takes chips out of the balance and records them as held for a game. Returns the hold's
// id, or null when the balance is too small. One statement checks and subtracts, so two
// bets at once cannot spend the same chips.
export function holdChips(userId: string, game: string, amount: number): number | null {
	ensureBalance(userId);
	return db.transaction((tx) => {
		const taken = tx
			.update(chipBalances)
			.set({ chips: sql`${chipBalances.chips} - ${amount}` })
			.where(and(eq(chipBalances.userId, userId), gte(chipBalances.chips, amount)))
			.run();
		if (taken.changes === 0) return null;
		const hold = tx
			.insert(chipHolds)
			.values({ userId, game, amount, createdAt: new Date() })
			.returning({ id: chipHolds.id })
			.get();
		return hold.id;
	});
}

// Adds more to an existing hold, as when doubling down. Returns false when the balance is
// too small.
export function addToHold(holdId: number, userId: string, amount: number): boolean {
	return db.transaction((tx) => {
		const taken = tx
			.update(chipBalances)
			.set({ chips: sql`${chipBalances.chips} - ${amount}` })
			.where(and(eq(chipBalances.userId, userId), gte(chipBalances.chips, amount)))
			.run();
		if (taken.changes === 0) return false;
		tx.update(chipHolds)
			.set({ amount: sql`${chipHolds.amount} + ${amount}` })
			.where(eq(chipHolds.id, holdId))
			.run();
		return true;
	});
}

// Ends a hold, paying out `payout` chips (0 for a loss, the stake back for a push).
// Returns the new balance.
export function settleHold(holdId: number, userId: string, payout: number): number {
	return db.transaction((tx) => {
		tx.delete(chipHolds).where(eq(chipHolds.id, holdId)).run();
		const row = tx
			.update(chipBalances)
			.set({ chips: sql`${chipBalances.chips} + ${payout}` })
			.where(eq(chipBalances.userId, userId))
			.returning({ chips: chipBalances.chips })
			.get();
		return row?.chips ?? 0;
	});
}

// Returns every held chip to its owner. Called at startup, when no game can still be open.
export function refundAllHolds(): number {
	return db.transaction((tx) => {
		const holds = tx.select().from(chipHolds).all();
		for (const hold of holds) {
			tx.update(chipBalances)
				.set({ chips: sql`${chipBalances.chips} + ${hold.amount}` })
				.where(eq(chipBalances.userId, hold.userId))
				.run();
		}
		tx.delete(chipHolds).run();
		return holds.length;
	});
}

export type DailyResult = { claimed: true; balance: number } | { claimed: false; nextAt: Date };

export function claimDaily(userId: string): DailyResult {
	ensureBalance(userId);
	const now = new Date();
	const row = db
		.update(chipBalances)
		.set({ chips: sql`${chipBalances.chips} + ${DAILY_CHIPS}`, lastDailyAt: now })
		.where(
			and(
				eq(chipBalances.userId, userId),
				sql`(${chipBalances.lastDailyAt} is null or ${chipBalances.lastDailyAt} <= ${now.getTime() - DAILY_COOLDOWN_MS})`
			)
		)
		.returning({ chips: chipBalances.chips })
		.get();
	if (row) return { claimed: true, balance: row.chips };
	const last = db
		.select()
		.from(chipBalances)
		.where(eq(chipBalances.userId, userId))
		.get()?.lastDailyAt;
	return {
		claimed: false,
		nextAt: new Date((last?.getTime() ?? now.getTime()) + DAILY_COOLDOWN_MS)
	};
}

// Gives chips outright, as a prize. Returns the new balance.
export function awardChips(userId: string, amount: number): number {
	ensureBalance(userId);
	const row = db
		.update(chipBalances)
		.set({ chips: sql`${chipBalances.chips} + ${amount}` })
		.where(eq(chipBalances.userId, userId))
		.returning({ chips: chipBalances.chips })
		.get();
	return row?.chips ?? 0;
}
