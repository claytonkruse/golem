import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder
} from 'discord.js';
import { getBalance } from '../db/chips.ts';
import { formatChips } from '../lib/chips.ts';
import type { Command } from '../lib/command.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('chips')
		.setDescription('Show how many chips you have for games.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		await interaction.reply({
			content: `You have ${formatChips(getBalance(interaction.user.id))}.`,
			flags: MessageFlags.Ephemeral
		});
	}
} satisfies Command;
