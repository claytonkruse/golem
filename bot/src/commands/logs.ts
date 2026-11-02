import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	channelMention
} from 'discord.js';
import { logSettings } from '../db/log-channels.ts';
import type { Command } from '../lib/command.ts';
import { logEvents, logGroups } from '../lib/log-events.ts';
import { truncate } from '../lib/logging.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('logs')
		.setDescription('Show which channels each event is logged in.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
	async execute(interaction) {
		if (!interaction.inCachedGuild()) return;
		const settings = logSettings(interaction.guildId);

		const sections = logGroups.flatMap((group) => {
			const lines = logEvents
				.filter((event) => event.group === group.id && settings.has(event.key))
				.map((event) => {
					const channels = (settings.get(event.key) ?? []).map((id) => channelMention(id));
					return `${event.label}: ${channels.join(' ')}`;
				});
			return lines.length > 0 ? [`**${group.label}**\n${lines.join('\n')}`] : [];
		});

		const content =
			sections.length > 0
				? truncate(sections.join('\n\n'), 2000)
				: 'Nothing is logged yet. Use /loghere in a channel to start.';
		await interaction.reply({ content, flags: MessageFlags.Ephemeral });
	}
} satisfies Command;
