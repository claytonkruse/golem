import { ActivityType, Events } from 'discord.js';
import { config } from '../config.ts';
import { addGuilds } from '../db/guilds.ts';
import { inviteUrl } from '../lib/app-config.ts';
import type { Event } from '../lib/event.ts';

export const event = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		// Records servers that added Golem while it was offline. Servers that removed it
		// while offline keep their row; pruning here would be wrong once shards run in
		// separate processes, because each process only sees its own servers.
		addGuilds(
			client.guilds.cache
				.filter((guild) => guild.available)
				.map((guild) => ({ id: guild.id, joinedAt: guild.joinedAt }))
		);

		const servers = client.guilds.cache.size;
		const shards = client.ws.shards.size;
		console.log(`Golem is ready as ${client.user.tag} in ${servers} servers on ${shards} shards.`);
		console.log(`Invite: ${inviteUrl(config.clientId, config.invitePermissions)}`);
		client.user.setActivity('/help', { type: ActivityType.Listening });
	}
} satisfies Event<typeof Events.ClientReady>;
