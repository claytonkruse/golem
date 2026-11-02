import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder
} from 'discord.js';
import { addGuilds } from '../db/guilds.ts';
import { addLogChannel } from '../db/log-channels.ts';
import type { Command } from '../lib/command.ts';
import { chosenEvents, eventOption } from '../lib/log-command.ts';
import { isLogChannelType, missingLogPermissions } from '../lib/logging.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('loghere')
		.setDescription('Log an event in this channel.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild)
		// Server admins can hand this to other roles under Server Settings → Integrations.
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addStringOption(eventOption),
	async execute(interaction) {
		if (!interaction.inCachedGuild() || !interaction.channel) return;
		const { channel, guild } = interaction;
		const { events, label } = chosenEvents(interaction);

		if (!isLogChannelType(channel.type)) {
			await interaction.reply({
				content: 'Logs can go to text, announcement and voice channels, not threads or forums.',
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		const missing = missingLogPermissions(channel);
		if (missing.length > 0) {
			await interaction.reply({
				content: `Golem needs ${missing.join(', ')} in ${channel} before it can log here.`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Log settings belong to a server row, which may not exist yet if Golem joined while offline.
		addGuilds([{ id: guild.id, joinedAt: guild.joinedAt }]);
		addLogChannel(guild.id, events, channel.id);
		await interaction.reply({
			content: `Logging ${label} in ${channel}. Use /logstop to undo it.`,
			flags: MessageFlags.Ephemeral
		});
	}
} satisfies Command;
