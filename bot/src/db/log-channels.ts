import { and, eq, inArray } from 'drizzle-orm';
import type { LogEventKey } from '../lib/log-events.ts';
import { db } from './index.ts';
import { logChannels } from './schema.ts';

export function addLogChannel(guildId: string, events: LogEventKey[], channelId: string): void {
	if (events.length === 0) return;
	db.insert(logChannels)
		.values(events.map((event) => ({ guildId, event, channelId })))
		.onConflictDoNothing()
		.run();
}

export function removeLogChannel(guildId: string, events: LogEventKey[], channelId: string): void {
	if (events.length === 0) return;
	db.delete(logChannels)
		.where(
			and(
				eq(logChannels.guildId, guildId),
				eq(logChannels.channelId, channelId),
				inArray(logChannels.event, events)
			)
		)
		.run();
}

// When a channel is deleted, it stops being a log target for every event.
export function forgetLogChannel(channelId: string): void {
	db.delete(logChannels).where(eq(logChannels.channelId, channelId)).run();
}

export function logChannelsFor(guildId: string, event: LogEventKey): string[] {
	return db
		.select({ channelId: logChannels.channelId })
		.from(logChannels)
		.where(and(eq(logChannels.guildId, guildId), eq(logChannels.event, event)))
		.all()
		.map((row) => row.channelId);
}

// Every event's channels for one server. Events with no channels are absent.
export function logSettings(guildId: string): Map<string, string[]> {
	const settings = new Map<string, string[]>();
	const rows = db.select().from(logChannels).where(eq(logChannels.guildId, guildId)).all();
	for (const row of rows) {
		settings.set(row.event, [...(settings.get(row.event) ?? []), row.channelId]);
	}
	return settings;
}
