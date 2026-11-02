import {
	ChannelType,
	Colors,
	EmbedBuilder,
	PermissionFlagsBits,
	type Guild,
	type GuildBasedChannel,
	type PartialUser,
	type User
} from 'discord.js';
import { forgetLogChannel, logChannelsFor } from '../db/log-channels.ts';
import { logEventLabel, type LogEventKey } from './log-events.ts';

export const logColor = {
	create: Colors.Green,
	update: Colors.Yellow,
	delete: Colors.Red
} as const;

// Channel kinds that can hold log messages. Threads are left out because they archive
// and drop out of the cache.
const LOG_CHANNEL_TYPES = new Set<ChannelType>([
	ChannelType.GuildText,
	ChannelType.GuildAnnouncement,
	ChannelType.GuildVoice,
	ChannelType.GuildStageVoice
]);

export function isLogChannelType(type: ChannelType): boolean {
	return LOG_CHANNEL_TYPES.has(type);
}

const REQUIRED = [
	[PermissionFlagsBits.ViewChannel, 'View Channel'],
	[PermissionFlagsBits.SendMessages, 'Send Messages'],
	[PermissionFlagsBits.EmbedLinks, 'Embed Links']
] as const;

// Names of the permissions Golem is missing to post logs in this channel.
export function missingLogPermissions(channel: GuildBasedChannel): string[] {
	const me = channel.guild.members.me;
	const permissions = me ? channel.permissionsFor(me) : null;
	return REQUIRED.filter(([flag]) => !permissions?.has(flag)).map(([, name]) => name);
}

export async function sendLog(
	guild: Guild,
	event: LogEventKey,
	embed: EmbedBuilder
): Promise<void> {
	const channelIds = logChannelsFor(guild.id, event);
	if (channelIds.length === 0) return;

	embed.setFooter({ text: logEventLabel(event) }).setTimestamp();

	await Promise.all(
		channelIds.map(async (channelId) => {
			const channel = guild.channels.cache.get(channelId);
			// Every channel of an available server is cached, so a missing one was deleted
			// while Golem was offline.
			if (!channel) {
				forgetLogChannel(channelId);
				return;
			}
			if (!channel.isSendable() || missingLogPermissions(channel).length > 0) return;
			try {
				await channel.send({ embeds: [embed] });
			} catch (error) {
				console.error(`Could not send a ${event} log to ${channelId} in ${guild.id}.`, error);
			}
		})
	);
}

export function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function withUser(embed: EmbedBuilder, user: User | PartialUser): EmbedBuilder {
	return embed.setAuthor({
		name: user.username ?? 'Unknown user',
		iconURL: user.displayAvatarURL()
	});
}

// Adds a "Before → After" field, or nothing when the value did not change.
export function addChange(
	embed: EmbedBuilder,
	name: string,
	before: string | null | undefined,
	after: string | null | undefined
): boolean {
	if ((before ?? '') === (after ?? '')) return false;
	const show = (value: string | null | undefined) => (value ? truncate(value, 500) : '*none*');
	embed.addFields({ name, value: `${show(before)} → ${show(after)}` });
	return true;
}

export function logEmbed(color: number, title: string): EmbedBuilder {
	return new EmbedBuilder().setColor(color).setTitle(title);
}
