import { Client, GatewayIntentBits, type ClientEvents } from 'discord.js';
import { config } from './config.ts';
import { migrateDatabase } from './db/migrate.ts';
import type { Event } from './lib/event.ts';
import { loadCommands, loadEvents } from './lib/load.ts';
import { commands } from './registry.ts';

migrateDatabase();

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
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
	process.exit(1);
});
