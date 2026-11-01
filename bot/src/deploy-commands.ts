import { REST, Routes } from 'discord.js';
import { config } from './config.ts';
import { commandJson } from './lib/command.ts';
import { loadCommands } from './lib/load.ts';

// `pnpm bot:deploy` registers to DISCORD_GUILD_ID when it is set, otherwise globally.
// `pnpm bot:deploy:global` always registers globally and clears the test server's
// copies, which would otherwise show every command twice there.
const guildId = process.argv.includes('--global') ? undefined : config.guildId;

const body = (await loadCommands()).map((command) => commandJson(command));
const rest = new REST().setToken(config.token);

try {
	if (guildId) {
		await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body });
		console.log(`Registered ${body.length} guild commands for ${guildId}.`);
	} else {
		await rest.put(Routes.applicationCommands(config.clientId), { body });
		console.log(
			`Registered ${body.length} global commands. Discord can take up to an hour to show them.`
		);
		if (config.guildId) {
			await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
				body: []
			});
			console.log(`Cleared guild commands for ${config.guildId}.`);
		}
	}
} catch (error) {
	console.error('Failed to register commands.', error);
	process.exit(1);
}
