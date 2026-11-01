import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder
} from 'discord.js';
import type { Command } from '../lib/command.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Check whether Golem is responding.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		const response = await interaction.reply({
			content: 'Pinging…',
			flags: MessageFlags.Ephemeral,
			withResponse: true
		});
		const sent = response.resource?.message;
		const roundTrip = sent
			? `${sent.createdTimestamp - interaction.createdTimestamp}ms`
			: 'unknown';
		const gateway = interaction.client.ws.ping;
		const gatewayText = gateway < 0 ? 'unavailable' : `${Math.round(gateway)}ms`;
		await interaction.editReply(`Pong. Round trip ${roundTrip}. Gateway ${gatewayText}.`);
	}
} satisfies Command;
