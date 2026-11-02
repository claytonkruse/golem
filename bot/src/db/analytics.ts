import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { memberActivity, memberEvents } from './schema.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
// Retention is checked this many days after each join.
export const RETENTION_DAYS = [1, 7, 30] as const;

// Days are UTC, so every server's charts line up the same way.
export function dayOf(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function recordMemberEvent(guildId: string, userId: string, kind: 'join' | 'leave'): void {
	db.insert(memberEvents).values({ guildId, userId, kind, at: new Date() }).run();
}

export function recordMessage(guildId: string, userId: string): void {
	db.insert(memberActivity)
		.values({ guildId, day: dayOf(new Date()), userId, messages: 1 })
		.onConflictDoUpdate({
			target: [memberActivity.guildId, memberActivity.day, memberActivity.userId],
			set: { messages: sql`${memberActivity.messages} + 1` }
		})
		.run();
}

export type AnalyticsDay = {
	day: string;
	joins: number;
	leaves: number;
	// Joins minus leaves from the start of the range up to and including this day.
	net: number;
	messages: number;
	activeMembers: number;
};

export type Retention = {
	days: (typeof RETENTION_DAYS)[number];
	// Joins in the range that are at least `days` old, and how many of those members were
	// still here `days` later.
	joins: number;
	stayed: number;
};

export type GuildAnalytics = {
	days: AnalyticsDay[];
	retention: Retention[];
	// The first day anything was recorded for this server, or null if nothing has been yet.
	trackedSince: string | null;
};

// The last `days` days, today included.
export function guildAnalytics(guildId: string, days: number, now = new Date()): GuildAnalytics {
	const firstDay = new Date(Date.parse(dayOf(now)) - (days - 1) * DAY_MS);
	const byDay = new Map<string, AnalyticsDay>();
	for (let i = 0; i < days; i++) {
		const day = dayOf(new Date(firstDay.getTime() + i * DAY_MS));
		byDay.set(day, { day, joins: 0, leaves: 0, net: 0, messages: 0, activeMembers: 0 });
	}

	const events = db
		.select()
		.from(memberEvents)
		.where(and(eq(memberEvents.guildId, guildId), gte(memberEvents.at, firstDay)))
		.orderBy(memberEvents.at)
		.all();
	for (const event of events) {
		const entry = byDay.get(dayOf(event.at));
		if (!entry) continue;
		if (event.kind === 'join') entry.joins++;
		else entry.leaves++;
	}

	const activity = db
		.select({
			day: memberActivity.day,
			messages: sql<number>`sum(${memberActivity.messages})`,
			activeMembers: sql<number>`count(*)`
		})
		.from(memberActivity)
		.where(and(eq(memberActivity.guildId, guildId), gte(memberActivity.day, dayOf(firstDay))))
		.groupBy(memberActivity.day)
		.all();
	for (const row of activity) {
		const entry = byDay.get(row.day);
		if (!entry) continue;
		entry.messages = row.messages;
		entry.activeMembers = row.activeMembers;
	}

	let net = 0;
	for (const entry of byDay.values()) {
		net += entry.joins - entry.leaves;
		entry.net = net;
	}

	// A member counts as staying if the member didn't leave within that many days of joining.
	const leaves = new Map<string, number[]>();
	for (const event of events) {
		if (event.kind === 'leave')
			leaves.set(event.userId, [...(leaves.get(event.userId) ?? []), event.at.getTime()]);
	}
	const joins = events.filter((event) => event.kind === 'join');
	const retention = RETENTION_DAYS.map((after) => {
		const window = after * DAY_MS;
		const old = joins.filter((join) => join.at.getTime() + window <= now.getTime());
		const stayed = old.filter((join) => {
			const start = join.at.getTime();
			return !(leaves.get(join.userId) ?? []).some((at) => at > start && at <= start + window);
		});
		return { days: after, joins: old.length, stayed: stayed.length };
	});

	const firstEvent = db
		.select({ at: sql<number>`min(${memberEvents.at})` })
		.from(memberEvents)
		.where(eq(memberEvents.guildId, guildId))
		.get()?.at;
	const firstActivity = db
		.select({ day: sql<string>`min(${memberActivity.day})` })
		.from(memberActivity)
		.where(eq(memberActivity.guildId, guildId))
		.get()?.day;
	const candidates = [firstEvent ? dayOf(new Date(firstEvent)) : null, firstActivity ?? null];
	const trackedSince = candidates.filter((day) => day !== null).sort()[0] ?? null;

	return { days: [...byDay.values()], retention, trackedSince };
}
