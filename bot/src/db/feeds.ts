import { and, asc, eq, isNull, lte, notExists, sql } from 'drizzle-orm';
import type { FeedKind, FeedSourceInfo } from '../feeds/sources.ts';
import { db } from './index.ts';
import { feedSources, feedSubscriptions, type FeedState } from './schema.ts';

// Who follows what. A subscription in a server posts to a channel; one made in a DM posts
// to the person who made it (guildId null, channelId their user id).

export const MAX_SERVER_FEEDS = 25;
export const MAX_DM_FEEDS = 10;

export type FeedTarget = { guildId: string; channelId: string } | { userId: string };

export type FeedSource = typeof feedSources.$inferSelect & { kind: FeedKind };

export type Subscription = {
	id: number;
	kind: FeedKind;
	title: string;
	url: string;
	channelId: string;
	// The subscription's own problem first (like missing permissions), else the source's.
	error: string | null;
};

const targetGuild = (target: FeedTarget) => ('guildId' in target ? target.guildId : null);
const targetChannel = (target: FeedTarget) =>
	'guildId' in target ? target.channelId : target.userId;

function scope(target: FeedTarget | { guildId: string }) {
	return 'userId' in target
		? and(isNull(feedSubscriptions.guildId), eq(feedSubscriptions.channelId, target.userId))
		: eq(feedSubscriptions.guildId, target.guildId);
}

export function feedCount(target: FeedTarget | { guildId: string }): number {
	return (
		db
			.select({ value: sql<number>`count(*)` })
			.from(feedSubscriptions)
			.where(scope(target))
			.get()?.value ?? 0
	);
}

export function feedLimit(target: FeedTarget | { guildId: string }): number {
	return 'userId' in target ? MAX_DM_FEEDS : MAX_SERVER_FEEDS;
}

export type AddResult = 'added' | 'exists' | 'full';

// The source row is shared: following something another server already follows reuses its
// row and the state it has, so nothing from before this subscription is posted.
export function subscribe(source: FeedSourceInfo, target: FeedTarget): AddResult {
	return db.transaction((tx) => {
		const count =
			tx
				.select({ value: sql<number>`count(*)` })
				.from(feedSubscriptions)
				.where(scope(target))
				.get()?.value ?? 0;
		if (count >= feedLimit(target)) return 'full';

		tx.insert(feedSources)
			.values({
				kind: source.kind,
				key: source.key,
				title: source.title,
				url: source.url,
				state: source.state,
				nextCheckAt: new Date(Date.now() + 60_000)
			})
			.onConflictDoNothing()
			.run();
		const row = tx
			.select({ id: feedSources.id })
			.from(feedSources)
			.where(and(eq(feedSources.kind, source.kind), eq(feedSources.key, source.key)))
			.get();
		if (!row) throw new Error('The feed source was not saved.');

		const inserted = tx
			.insert(feedSubscriptions)
			.values({
				sourceId: row.id,
				guildId: targetGuild(target),
				channelId: targetChannel(target),
				createdAt: new Date()
			})
			.onConflictDoNothing()
			.run();
		return inserted.changes > 0 ? 'added' : 'exists';
	});
}

export function subscriptions(target: FeedTarget | { guildId: string }): Subscription[] {
	return db
		.select({
			id: feedSubscriptions.id,
			kind: feedSources.kind,
			title: feedSources.title,
			url: feedSources.url,
			channelId: feedSubscriptions.channelId,
			subscriptionError: feedSubscriptions.lastError,
			sourceError: feedSources.lastError
		})
		.from(feedSubscriptions)
		.innerJoin(feedSources, eq(feedSources.id, feedSubscriptions.sourceId))
		.where(scope(target))
		.orderBy(asc(feedSources.title), asc(feedSubscriptions.id))
		.all()
		.map(({ subscriptionError, sourceError, ...row }) => ({
			...row,
			kind: row.kind as FeedKind,
			error: subscriptionError ?? sourceError
		}));
}

// Only removes a subscription that belongs to the server or person asking.
export function unsubscribe(id: number, target: FeedTarget | { guildId: string }): boolean {
	const result = db
		.delete(feedSubscriptions)
		.where(and(eq(feedSubscriptions.id, id), scope(target)))
		.run();
	if (result.changes > 0) deleteUnfollowedSources();
	return result.changes > 0;
}

export function removeChannelFeeds(channelId: string): void {
	db.delete(feedSubscriptions)
		.where(
			and(eq(feedSubscriptions.channelId, channelId), sql`${feedSubscriptions.guildId} is not null`)
		)
		.run();
	deleteUnfollowedSources();
}

export function deleteUnfollowedSources(): void {
	db.delete(feedSources)
		.where(
			notExists(
				db
					.select({ id: feedSubscriptions.id })
					.from(feedSubscriptions)
					.where(eq(feedSubscriptions.sourceId, feedSources.id))
			)
		)
		.run();
}

export function dueSources(now: Date, limit: number): FeedSource[] {
	return db
		.select()
		.from(feedSources)
		.where(lte(feedSources.nextCheckAt, now))
		.orderBy(asc(feedSources.nextCheckAt))
		.limit(limit)
		.all() as FeedSource[];
}

export function sourceSubscriptions(sourceId: number) {
	return db
		.select({
			id: feedSubscriptions.id,
			guildId: feedSubscriptions.guildId,
			channelId: feedSubscriptions.channelId
		})
		.from(feedSubscriptions)
		.where(eq(feedSubscriptions.sourceId, sourceId))
		.all();
}

export function recordCheck(
	id: number,
	result: { title: string; url: string; state: FeedState },
	nextCheckAt: Date
): void {
	db.update(feedSources)
		.set({ ...result, nextCheckAt, failures: 0, lastError: null })
		.where(eq(feedSources.id, id))
		.run();
}

export function recordFailure(id: number, error: string, nextCheckAt: Date): void {
	db.update(feedSources)
		.set({ failures: sql`${feedSources.failures} + 1`, lastError: error, nextCheckAt })
		.where(eq(feedSources.id, id))
		.run();
}

export function setSubscriptionError(id: number, error: string | null): void {
	db.update(feedSubscriptions).set({ lastError: error }).where(eq(feedSubscriptions.id, id)).run();
}
