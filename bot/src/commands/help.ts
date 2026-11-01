import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder
} from 'discord.js';
import { commandSummaries, type Command } from '../lib/command.ts';
import { commands } from '../registry.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('List the slash commands Golem has loaded.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		const lines = [...commands.values()]
			.flatMap((entry) => commandSummaries(entry))
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((entry) => `/${entry.name} — ${entry.description}`);

		const body = lines.length > 0 ? lines.join('\n') : 'No commands are loaded.';
		await interaction.reply({ content: body, flags: MessageFlags.Ephemeral });
	}
} satisfies Command;
