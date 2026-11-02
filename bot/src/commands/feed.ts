import {
	ApplicationIntegrationType,
	channelMention,
	ChannelType,
	escapeMarkdown,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type InteractionReplyOptions
} from 'discord.js';
import { addGuilds } from '../db/guilds.ts';
import {
	feedCount,
	feedLimit,
	subscribe,
	subscriptions,
	unsubscribe,
	type FeedTarget
} from '../db/feeds.ts';
import { FeedError } from '../feeds/fetch.ts';
import { botFeedKeys } from '../feeds/keys.ts';
import {
	feedKindAvailable,
	feedKinds,
	isFeedKind,
	resolveFeed,
	type FeedKind
} from '../feeds/sources.ts';
import type { Command } from '../lib/command.ts';
import { isLogChannelType, missingLogPermissions } from '../lib/logging.ts';

// The same feeds as the dashboard's Feeds page. In a DM, updates come to the person's DMs.

type Where = { target: FeedTarget | { guildId: string }; label: string };

// Private in servers so the channel isn't cluttered; ordinary in DMs, where only the
// person sees it anyway and an ephemeral reply would just disappear.
function reply(interaction: ChatInputCommandInteraction, content: string) {
	const options: InteractionReplyOptions = { content, allowedMentions: { parse: [] } };
	if (interaction.inGuild()) options.flags = MessageFlags.Ephemeral;
	return interaction.deferred || interaction.replied
		? interaction.editReply({ content, allowedMentions: { parse: [] } })
		: interaction.reply(options);
}

function scopeOf(interaction: ChatInputCommandInteraction): Where | null {
	if (interaction.inCachedGuild()) {
		return { target: { guildId: interaction.guildId }, label: 'this server' };
	}
	if (interaction.inGuild()) return null;
	return { target: { userId: interaction.user.id }, label: 'your DMs' };
}

// "Golem will post new videos from **X** in #channel." / "Golem will DM you when **X** goes live."
function followed(kind: FeedKind, title: string, channelId: string | null): string {
	const name = `**${escapeMarkdown(title)}**`;
	const how = channelId ? `post in ${channelMention(channelId)}` : 'DM you';
	if (kind === 'twitch' || kind === 'kick') return `Golem will ${how} when ${name} goes live.`;
	const what = kind === 'youtube' ? 'new videos' : 'new posts';
	return `Golem will ${how} with ${what} from ${name}.`;
}

async function add(interaction: ChatInputCommandInteraction, where: Where): Promise<void> {
	const kind = interaction.options.getString('type', true);
	const input = interaction.options.getString('source', true);
	if (!isFeedKind(kind)) return void (await reply(interaction, 'Pick a feed type from the list.'));
	if (!feedKindAvailable(kind, botFeedKeys())) {
		return void (await reply(
			interaction,
			`${feedKinds[kind].label} feeds aren't set up on this Golem yet.`
		));
	}

	let target: FeedTarget;
	if ('userId' in where.target) {
		target = where.target;
	} else {
		if (!interaction.inCachedGuild()) return;
		const channel = interaction.options.getChannel('channel') ?? interaction.channel;
		if (!channel || !('guild' in channel) || !isLogChannelType(channel.type)) {
			return void (await reply(
				interaction,
				'Feeds can go to text, announcement and voice channels, not threads or forums.'
			));
		}
		const missing = missingLogPermissions(channel);
		if (missing.length > 0) {
			return void (await reply(
				interaction,
				`Golem needs ${missing.join(', ')} in ${channel} to post feeds there.`
			));
		}
		addGuilds([{ id: interaction.guild.id, joinedAt: interaction.guild.joinedAt }]);
		target = { guildId: interaction.guildId, channelId: channel.id };
	}

	if (feedCount(where.target) >= feedLimit(where.target)) {
		return void (await reply(
			interaction,
			`${where.label === 'your DMs' ? 'You follow' : 'This server follows'} ${feedLimit(where.target)} feeds, the most Golem allows. Remove one with /feed remove first.`
		));
	}

	// Looking the feed up can take a few seconds.
	await interaction.deferReply(interaction.inGuild() ? { flags: MessageFlags.Ephemeral } : {});
	let source;
	try {
		source = await resolveFeed(kind, input, botFeedKeys());
	} catch (error) {
		if (!(error instanceof FeedError)) throw error;
		return void (await reply(interaction, error.message));
	}
	const result = subscribe(source, target);
	const place = 'channelId' in target ? ` in ${channelMention(target.channelId)}` : '';
	if (result === 'exists') {
		return void (await reply(
			interaction,
			`**${escapeMarkdown(source.title)}** is already followed${place}.`
		));
	}
	if (result === 'full') {
		return void (await reply(interaction, 'That is as many feeds as Golem allows here.'));
	}
	await reply(
		interaction,
		followed(kind, source.title, 'channelId' in target ? target.channelId : null)
	);
}

async function list(interaction: ChatInputCommandInteraction, where: Where): Promise<void> {
	const feeds = subscriptions(where.target);
	if (feeds.length === 0) {
		return void (await reply(
			interaction,
			`Nothing is followed in ${where.label} yet. Add a feed with /feed add.`
		));
	}
	const lines = feeds.map((feed) => {
		const place = 'guildId' in where.target ? ` → ${channelMention(feed.channelId)}` : '';
		const problem = feed.error ? `\n  ⚠️ ${feed.error}` : '';
		return `- [${escapeMarkdown(feed.title)}](<${feed.url}>) · ${feedKinds[feed.kind].label}${place}${problem}`;
	});
	await reply(
		interaction,
		`**Feeds in ${where.label}** (${feeds.length} of ${feedLimit(where.target)})\n${lines.join('\n')}`.slice(
			0,
			2000
		)
	);
}

async function remove(interaction: ChatInputCommandInteraction, where: Where): Promise<void> {
	const id = Number(interaction.options.getString('feed', true));
	const feed = subscriptions(where.target).find((entry) => entry.id === id);
	if (!feed || !unsubscribe(id, where.target)) {
		return void (await reply(interaction, 'Pick one of the feeds from the list.'));
	}
	await reply(interaction, `Stopped following **${escapeMarkdown(feed.title)}**.`);
}

export const command = {
	data: new SlashCommandBuilder()
		.setName('feed')
		.setDescription('Follow RSS, YouTube, Twitch and Kick feeds here, or in your DMs.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
		// Servers only; in a DM with Golem anyone manages the feeds for that DM. Admins can hand
		// this to other roles under Server Settings → Integrations.
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((sub) =>
			sub
				.setName('add')
				.setDescription('Follow a feed.')
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('What to follow')
						.setRequired(true)
						.addChoices(
							...Object.entries(feedKinds).map(([value, kind]) => ({
								name: kind.label,
								value
							}))
						)
				)
				.addStringOption((option) =>
					option
						.setName('source')
						.setDescription('A feed or website link, YouTube channel, or streamer username')
						.setRequired(true)
						.setMaxLength(2000)
				)
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Where to post (this channel if left out; ignored in DMs)')
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildAnnouncement,
							ChannelType.GuildVoice
						)
				)
		)
		.addSubcommand((sub) => sub.setName('list').setDescription('Show the feeds followed here.'))
		.addSubcommand((sub) =>
			sub
				.setName('remove')
				.setDescription('Stop following a feed.')
				.addStringOption((option) =>
					option
						.setName('feed')
						.setDescription('The feed to stop following')
						.setRequired(true)
						.setAutocomplete(true)
				)
		),

	async execute(interaction) {
		const where = scopeOf(interaction);
		if (!where) return void (await reply(interaction, 'Golem is not in this server.'));
		switch (interaction.options.getSubcommand()) {
			case 'add':
				return add(interaction, where);
			case 'list':
				return list(interaction, where);
			case 'remove':
				return remove(interaction, where);
		}
	},

	async autocomplete(interaction) {
		const target = interaction.inCachedGuild()
			? { guildId: interaction.guildId }
			: { userId: interaction.user.id };
		const typed = interaction.options.getFocused().toLowerCase();
		const channelName = (id: string) =>
			interaction.inCachedGuild() ? interaction.guild.channels.cache.get(id)?.name : undefined;
		const choices = subscriptions(target)
			.map((feed) => {
				const channel = 'guildId' in target ? channelName(feed.channelId) : undefined;
				const name = `${feed.title} (${feedKinds[feed.kind].label}${channel ? `, #${channel}` : ''})`;
				return { name: name.slice(0, 100), value: String(feed.id) };
			})
			.filter((choice) => choice.name.toLowerCase().includes(typed))
			.slice(0, 25);
		await interaction.respond(choices);
	}
} satisfies Command;
