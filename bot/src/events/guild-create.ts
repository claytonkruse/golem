import { Events } from 'discord.js';
import { addGuilds } from '../db/guilds.ts';
import type { Event } from '../lib/event.ts';

// discord.js only emits this for servers that add Golem after login, not for the
// servers it already belongs to at startup.
export const event = {
	name: Events.GuildCreate,
	execute(guild) {
		addGuilds([{ id: guild.id, joinedAt: guild.joinedAt }]);
		console.log(
			`Joined ${guild.name} (${guild.id}). Now in ${guild.client.guilds.cache.size} servers.`
		);
	}
} satisfies Event<typeof Events.GuildCreate>;
