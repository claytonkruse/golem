import { Events } from 'discord.js';
import type { Event } from '../lib/event.ts';

export const event = {
	name: Events.ShardError,
	execute(error, shardId) {
		console.error(`Shard ${shardId} lost its connection.`, error);
	}
} satisfies Event<typeof Events.ShardError>;
