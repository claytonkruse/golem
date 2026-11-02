import { Events } from 'discord.js';
import { removeChannelFeeds } from '../db/feeds.ts';
import { botFeedKeys } from '../feeds/keys.ts';
import { startFeedPoller } from '../feeds/poller.ts';
import type { Event } from '../lib/event.ts';

// Feeds are checked from one place. Once shards run in separate processes this has to move
// to a single process, like the refund of held chips.
export const events = [
	{
		name: Events.ClientReady,
		once: true,
		execute(client) {
			startFeedPoller(client, botFeedKeys());
		}
	} satisfies Event<typeof Events.ClientReady>,
	{
		name: Events.ChannelDelete,
		execute(channel) {
			if (!channel.isDMBased()) removeChannelFeeds(channel.id);
		}
	} satisfies Event<typeof Events.ChannelDelete>
];
