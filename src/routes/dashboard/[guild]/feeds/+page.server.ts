import { fail } from '@sveltejs/kit';
import { MAX_SERVER_FEEDS, subscriptions, unsubscribe } from '#bot/db/feeds.ts';
import { addFeed, feedKindOptions } from '#lib/server/feeds.js';
import { joinedGuild } from '#lib/server/guilds.js';
import { logChannelOptions } from '#lib/server/logging.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	return {
		feeds: {
			kinds: feedKindOptions(),
			channels: await logChannelOptions(guild.id),
			list: subscriptions({ guildId: guild.id }),
			limit: MAX_SERVER_FEEDS
		}
	};
};

// Every action re-checks access: form posts do not go through the page's load.
export const actions: Actions = {
	add: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const channelId = String(form.get('channel') ?? '');
		const channels = await logChannelOptions(guild.id);
		if (!channels.some((channel) => channel.id === channelId)) {
			return fail(400, {
				kind: String(form.get('kind') ?? ''),
				source: String(form.get('source') ?? ''),
				channel: channelId,
				message: 'Pick a channel to post in.'
			});
		}
		return addFeed(form, { guildId: guild.id, channelId });
	},
	remove: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		unsubscribe(Number(form.get('id')), { guildId: guild.id });
	}
};
