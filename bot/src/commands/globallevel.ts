import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import type { Command } from '../lib/command.ts';
import { replyLevel } from '../lib/leveling.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('globallevel')
		.setDescription('Show your level card across every server.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		await replyLevel(interaction, 'global');
	}
} satisfies Command;
