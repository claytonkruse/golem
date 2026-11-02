import { and, eq } from 'drizzle-orm';
import type { LogEventKey } from '../lib/log-events.ts';
import { db } from './index.ts';
import { logOptions } from './schema.ts';

export function setLogOption(
	guildId: string,
	event: LogEventKey,
	option: string,
	enabled: boolean
): void {
	if (enabled) {
		db.insert(logOptions).values({ guildId, event, option }).onConflictDoNothing().run();
	} else {
		db.delete(logOptions)
			.where(
				and(
					eq(logOptions.guildId, guildId),
					eq(logOptions.event, event),
					eq(logOptions.option, option)
				)
			)
			.run();
	}
}

export function hasLogOption(guildId: string, event: LogEventKey, option: string): boolean {
	const row = db
		.select({ option: logOptions.option })
		.from(logOptions)
		.where(
			and(
				eq(logOptions.guildId, guildId),
				eq(logOptions.event, event),
				eq(logOptions.option, option)
			)
		)
		.get();
	return row !== undefined;
}

// Every enabled option for one server, as "event:option" strings.
export function logOptionSettings(guildId: string): string[] {
	return db
		.select()
		.from(logOptions)
		.where(eq(logOptions.guildId, guildId))
		.all()
		.map((row) => `${row.event}:${row.option}`);
}

// Servers with an option on, so the bot can prepare for them at startup.
export function guildsWithLogOption(event: LogEventKey, option: string): string[] {
	return db
		.select({ guildId: logOptions.guildId })
		.from(logOptions)
		.where(and(eq(logOptions.event, event), eq(logOptions.option, option)))
		.all()
		.map((row) => row.guildId);
}
