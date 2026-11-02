import { Events } from 'discord.js';
import { refundAllHolds } from '../db/chips.ts';
import type { Event } from '../lib/event.ts';

// Games live in memory, so any chips still held at startup belong to games a restart cut
// short. Their players get the chips back. Once shards run in separate processes this has
// to move to a single place that starts before any of them.
export const event = {
	name: Events.ClientReady,
	once: true,
	execute() {
		const refunded = refundAllHolds();
		if (refunded > 0) console.log(`Refunded ${refunded} bets from games a restart ended.`);
	}
} satisfies Event<typeof Events.ClientReady>;
