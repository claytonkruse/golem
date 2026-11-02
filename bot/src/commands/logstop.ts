import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder
} from 'discord.js';
import { removeLogChannel } from '../db/log-channels.ts';
import type { Command } from '../lib/command.ts';
import { chosenEvents, eventOption } from '../lib/log-command.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('logstop')
		.setDescription('Stop logging an event in this channel.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addStringOption(eventOption),
	async execute(interaction) {
		if (!interaction.inCachedGuild() || !interaction.channel) return;
		const { events, label } = chosenEvents(interaction);
		removeLogChannel(interaction.guildId, events, interaction.channelId);
		await interaction.reply({
			content: `No longer logging ${label} in ${interaction.channel}.`,
			flags: MessageFlags.Ephemeral
		});
	}
} satisfies Command;
