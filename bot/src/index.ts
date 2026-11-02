import { Client, GatewayIntentBits, Partials, type ClientEvents } from 'discord.js';
import { config } from './config.ts';
import { migrateDatabase } from './db/migrate.ts';
import type { Event } from './lib/event.ts';
import { loadCommands, loadEvents } from './lib/load.ts';
import { commands } from './registry.ts';

migrateDatabase();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildExpressions,
		GatewayIntentBits.GuildMessages,
		// Privileged: both must be switched on under Bot in the developer portal, and
		// Discord must approve them once Golem is in 100 servers.
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.MessageContent
	],
	// Lets deletes and edits of messages sent before startup through, without their text.
	partials: [Partials.Message, Partials.GuildMember, Partials.User],
	// Message logs need cached text, but keeping every message forever would grow without
	// bound across thousands of servers.
	sweepers: {
		messages: { interval: 60 * 60, lifetime: 6 * 60 * 60 }
	},
	// Discord requires sharding past 2,500 servers. 'auto' asks the gateway for the
	// recommended count and runs every shard in this process.
	shards: 'auto',
	// Mentions in replies never ping anyone unless a reply opts in, so a command that
	// echoes user text cannot be used to ping @everyone or a role in someone's server.
	allowedMentions: { parse: [], repliedUser: false }
});

for (const command of await loadCommands()) {
	const name = command.data.name;
	if (commands.has(name)) {
		throw new Error(`Duplicate slash command: ${name}`);
	}
	commands.set(name, command);
}

function listen<K extends keyof ClientEvents>(event: Event<K>) {
	const handler = (...args: ClientEvents[K]) => {
		Promise.resolve()
			.then(() => event.execute(...args))
			.catch((error: unknown) => {
				console.error(`The ${event.name} handler failed.`, error);
			});
	};
	if (event.once) client.once(event.name, handler);
	else client.on(event.name, handler);
}

for (const event of await loadEvents()) {
	listen(event);
}

process.on('unhandledRejection', (error) => {
	console.error('Unhandled promise rejection.', error);
});

const shutdown = async () => {
	await client.destroy();
	process.exit(0);
};

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

client.login(config.token).catch((error: unknown) => {
	console.error('Golem failed to log in.', error);
	if (error instanceof Error && /disallowed intents/i.test(error.message)) {
		console.error(
			'Turn on Server Members Intent and Message Content Intent under Bot in the developer portal.'
		);
	}
	process.exit(1);
});
