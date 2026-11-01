import { Events } from 'discord.js';
import { removeGuild } from '../db/guilds.ts';
import type { Event } from '../lib/event.ts';

export const event = {
	name: Events.GuildDelete,
	execute(guild) {
		// An unavailable guild is a Discord outage, not a removal.
		if (!guild.available) return;
		removeGuild(guild.id);
		console.log(
			`Removed from ${guild.name} (${guild.id}). Now in ${guild.client.guilds.cache.size} servers.`
		);
	}
} satisfies Event<typeof Events.GuildDelete>;
