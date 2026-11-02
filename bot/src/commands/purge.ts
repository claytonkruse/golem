import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	userMention,
	type Snowflake
} from 'discord.js';
import type { Command } from '../lib/command.ts';

// Discord only lets bots bulk-delete messages younger than 14 days. A little margin keeps a
// message that turns 14 days old mid-purge from failing the whole request.
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 - 60_000;
// How far back to look for a member's messages before giving up.
const SCAN_LIMIT = 1000;

const required = [
	[PermissionFlagsBits.ViewChannel, 'View Channel'],
	[PermissionFlagsBits.ReadMessageHistory, 'Read Message History'],
	[PermissionFlagsBits.ManageMessages, 'Manage Messages']
] as const;

export const command = {
	data: new SlashCommandBuilder()
		.setName('purge')
		.setDescription('Delete recent messages in this channel, optionally only from one member.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild)
		// Server admins can hand this to other roles under Server Settings → Integrations.
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('How many messages to delete (up to 100)')
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(100)
		)
		.addUserOption((option) =>
			option.setName('user').setDescription('Only delete messages from this member')
		),

	async execute(interaction) {
		if (!interaction.inCachedGuild() || !interaction.channel) return;
		const { channel } = interaction;
		const amount = interaction.options.getInteger('amount', true);
		const target = interaction.options.getUser('user');
		const reply = (content: string) =>
			interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

		if (!('bulkDelete' in channel)) {
			await reply("Messages can't be purged in this kind of channel.");
			return;
		}
		const me = interaction.guild.members.me;
		const permissions = me ? channel.permissionsFor(me) : null;
		const missing = required.filter(([flag]) => !permissions?.has(flag)).map(([, name]) => name);
		if (missing.length > 0) {
			await reply(`Golem needs ${missing.join(', ')} in ${channel} to purge messages.`);
			return;
		}

		// Finding a member's messages can take a few pages of history.
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const cutoff = Date.now() - BULK_DELETE_MAX_AGE_MS;
		const picked: Snowflake[] = [];
		let tooOld = false;
		let pinnedSkipped = 0;
		let before: Snowflake | undefined;
		let scanned = 0;

		while (picked.length < amount && scanned < SCAN_LIMIT) {
			const page = await channel.messages.fetch({ limit: 100, before });
			if (page.size === 0) break;
			for (const message of page.values()) {
				scanned++;
				if (message.createdTimestamp < cutoff) {
					tooOld = true;
					break;
				}
				if (target && message.author.id !== target.id) continue;
				if (message.pinned) {
					pinnedSkipped++;
					continue;
				}
				picked.push(message.id);
				if (picked.length === amount) break;
			}
			if (tooOld) break;
			before = page.lastKey();
		}

		const deleted = picked.length > 0 ? (await channel.bulkDelete(picked, true)).size : 0;

		const whose = target ? ` from ${userMention(target.id)}` : '';
		const lines = [`Deleted ${deleted} ${deleted === 1 ? 'message' : 'messages'}${whose}.`];
		if (deleted < amount) {
			if (tooOld) lines.push("Discord doesn't let bots bulk-delete messages older than 14 days.");
			else if (target && scanned >= SCAN_LIMIT) {
				lines.push(`Golem looked through the last ${SCAN_LIMIT} messages and found no more.`);
			}
		}
		if (pinnedSkipped > 0) {
			lines.push(`Kept ${pinnedSkipped} pinned ${pinnedSkipped === 1 ? 'message' : 'messages'}.`);
		}
		await interaction.editReply({ content: lines.join(' '), allowedMentions: { parse: [] } });
	}
} satisfies Command;
