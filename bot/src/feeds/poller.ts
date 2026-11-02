import { DiscordAPIError, RESTJSONErrorCodes, type Client } from 'discord.js';
import {
	deleteUnfollowedSources,
	dueSources,
	recordCheck,
	recordFailure,
	setSubscriptionError,
	sourceSubscriptions,
	type FeedSource
} from '../db/feeds.ts';
import { FeedError } from './fetch.ts';
import type { FeedKeys } from './keys.ts';
import { checkFeed, feedKinds, type FeedPost } from './sources.ts';

// Checks whatever is due every half minute, a few sources at a time. A source that keeps
// failing is checked less often, up to every six hours, and shows its error in the
// dashboard and /feed list until it works again.

const TICK_MS = 30_000;
const BATCH = 25;
const PARALLEL = 4;
const MAX_BACKOFF_MS = 6 * 60 * 60_000;

function deliveryError(error: unknown): string {
	if (error instanceof DiscordAPIError) {
		switch (error.code) {
			case RESTJSONErrorCodes.UnknownChannel:
				return 'The channel no longer exists.';
			case RESTJSONErrorCodes.MissingAccess:
				return "Golem can't see the channel.";
			case RESTJSONErrorCodes.MissingPermissions:
				return 'Golem needs Send Messages and Embed Links in the channel.';
			case RESTJSONErrorCodes.CannotSendMessagesToThisUser:
				return "Golem can't DM you. Allow direct messages from Golem's servers or apps.";
		}
	}
	return "Golem couldn't post the update.";
}

async function deliver(
	client: Client,
	subscription: { id: number; guildId: string | null; channelId: string },
	posts: FeedPost[]
): Promise<void> {
	try {
		for (const post of posts) {
			if (subscription.guildId === null) {
				await client.users.send(subscription.channelId, post);
				continue;
			}
			const channel = await client.channels.fetch(subscription.channelId);
			if (!channel?.isSendable()) throw new Error('The channel cannot receive messages.');
			await channel.send(post);
		}
		setSubscriptionError(subscription.id, null);
	} catch (error) {
		if (!(error instanceof DiscordAPIError)) console.error('A feed post failed.', error);
		setSubscriptionError(subscription.id, deliveryError(error));
	}
}

async function check(client: Client, keys: FeedKeys, source: FeedSource): Promise<void> {
	const every = feedKinds[source.kind]?.everyMs ?? 10 * 60_000;
	let result;
	try {
		result = await checkFeed(source, keys);
	} catch (error) {
		if (!(error instanceof FeedError)) console.error(`Checking feed ${source.id} failed.`, error);
		const wait = Math.min(every * 2 ** (source.failures + 1), MAX_BACKOFF_MS);
		const message = error instanceof FeedError ? error.message : "The feed couldn't be checked.";
		recordFailure(source.id, message, new Date(Date.now() + wait));
		return;
	}
	// Saved before posting, so a crash mid-post can't post the same items twice.
	recordCheck(source.id, result, new Date(Date.now() + every));
	if (result.posts.length === 0) return;
	await Promise.all(
		sourceSubscriptions(source.id).map((subscription) =>
			deliver(client, subscription, result.posts)
		)
	);
}

export async function checkDueFeeds(client: Client, keys: FeedKeys): Promise<void> {
	deleteUnfollowedSources();
	const due = dueSources(new Date(), BATCH);
	for (let index = 0; index < due.length; index += PARALLEL) {
		await Promise.all(
			due.slice(index, index + PARALLEL).map((source) => check(client, keys, source))
		);
	}
}

export function startFeedPoller(client: Client, keys: FeedKeys): () => void {
	let running = false;
	const tick = async () => {
		if (running) return;
		running = true;
		try {
			await checkDueFeeds(client, keys);
		} catch (error) {
			console.error('Checking feeds failed.', error);
		} finally {
			running = false;
		}
	};
	const timer = setInterval(() => void tick(), TICK_MS);
	void tick();
	return () => clearInterval(timer);
}
