import {
	ApplicationIntegrationType,
	channelMention,
	ChannelType,
	codeBlock,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type ChatInputCommandInteraction
} from 'discord.js';
import { addGuilds } from '../db/guilds.ts';
import { countLeaves } from '../db/member-leaves.ts';
import { getWelcome, updateWelcome } from '../db/welcome.ts';
import type { Command } from '../lib/command.ts';
import { isLogChannelType } from '../lib/logging.ts';
import { welcomeValues } from '../lib/member-join.ts';
import { MAX_WELCOME_LENGTH, renderWelcome, welcomeVariables } from '../lib/welcome.ts';

// The same settings as the dashboard's Welcome page.

const reply = (interaction: ChatInputCommandInteraction, content: string) =>
	interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

async function set(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
	const { guild } = interaction;
	const current = getWelcome(guild.id);
	const channel =
		interaction.options.getChannel('channel') ??
		(current.channelId ? guild.channels.cache.get(current.channelId) : null) ??
		interaction.channel;
	if (!channel || !isLogChannelType(channel.type)) {
		return void (await reply(
			interaction,
			'Welcome messages can go to text, announcement and voice channels, not threads or forums.'
		));
	}
	const me = guild.members.me;
	const permissions = me ? channel.permissionsFor(me) : null;
	if (!permissions?.has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages)) {
		return void (await reply(
			interaction,
			`Golem needs View Channel and Send Messages in ${channelMention(channel.id)} to welcome people there.`
		));
	}
	// Slash command options are one line, so \n stands for a line break.
	const message = interaction.options.getString('message')?.replaceAll('\\n', '\n');

	// Settings belong to a server row, which may not exist yet if Golem joined while offline.
	addGuilds([{ id: guild.id, joinedAt: guild.joinedAt }]);
	updateWelcome(guild.id, {
		enabled: true,
		channelId: channel.id,
		...(message ? { message } : {})
	});
	await reply(
		interaction,
		`Golem will welcome new members in ${channelMention(channel.id)}. Use /welcome show to see the message, or /welcome off to stop.`
	);
}

async function show(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
	const welcome = getWelcome(interaction.guildId);
	const status = welcome.enabled
		? `On, in ${welcome.channelId ? channelMention(welcome.channelId) : 'no channel yet'}.`
		: 'Off. Turn it on with /welcome set.';
	// Shown as if the person running the command had just joined, with an unknown inviter.
	const preview = renderWelcome(
		welcome.message,
		welcomeValues(interaction.member, {
			invite: null,
			inviterCount: null,
			leaves: countLeaves(interaction.guildId, interaction.user.id)
		})
	);
	const variables = welcomeVariables.map(
		(variable) => `\`{${variable.key}}\` ${variable.description}`
	);
	const content = [
		`**Welcome message:** ${status}`,
		codeBlock(welcome.message.replaceAll('`', 'ˋ')),
		`**Preview for you:**\n${preview}`,
		`**Variables**\n${variables.join('\n')}`,
		'To see who invited people and how often they left before in your logs too, turn on those switches under **Member joined** with /loghere or on the dashboard’s Logging page.'
	].join('\n\n');
	await reply(interaction, content.slice(0, 2000));
}

export const command = {
	data: new SlashCommandBuilder()
		.setName('welcome')
		.setDescription('Post a message when someone joins.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild)
		// Server admins can hand this to other roles under Server Settings → Integrations.
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((sub) =>
			sub
				.setName('set')
				.setDescription('Turn welcome messages on, and change the channel or message.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Where to post (the current setting, or this channel, if left out)')
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildAnnouncement,
							ChannelType.GuildVoice
						)
				)
				.addStringOption((option) =>
					option
						.setName('message')
						.setDescription(
							'Use {user}, {server}, {inviter}, {invitecount}, {leavecount}… and \\n for a new line'
						)
						.setMaxLength(MAX_WELCOME_LENGTH)
				)
		)
		.addSubcommand((sub) => sub.setName('off').setDescription('Stop welcoming new members.'))
		.addSubcommand((sub) =>
			sub.setName('show').setDescription('Show the welcome message, a preview and its variables.')
		),

	async execute(interaction) {
		if (!interaction.inCachedGuild()) return;
		switch (interaction.options.getSubcommand()) {
			case 'set':
				return set(interaction);
			case 'off':
				addGuilds([{ id: interaction.guildId, joinedAt: interaction.guild.joinedAt }]);
				updateWelcome(interaction.guildId, { enabled: false });
				return void (await reply(interaction, 'Golem will stop welcoming new members.'));
			case 'show':
				return show(interaction);
		}
	}
} satisfies Command;
