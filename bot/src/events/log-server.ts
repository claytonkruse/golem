import {
	ChannelType,
	Events,
	GuildVerificationLevel,
	PermissionsBitField,
	channelMention,
	roleMention
} from 'discord.js';
import { forgetLogChannel } from '../db/log-channels.ts';
import type { Event } from '../lib/event.ts';
import { addChange, logColor, logEmbed, sendLog } from '../lib/logging.ts';

const channelKinds: Partial<Record<ChannelType, string>> = {
	[ChannelType.GuildText]: 'Text channel',
	[ChannelType.GuildVoice]: 'Voice channel',
	[ChannelType.GuildCategory]: 'Category',
	[ChannelType.GuildAnnouncement]: 'Announcement channel',
	[ChannelType.GuildStageVoice]: 'Stage channel',
	[ChannelType.GuildForum]: 'Forum',
	[ChannelType.GuildMedia]: 'Media channel'
};

function permissionNames(bits: bigint): string {
	const names = new PermissionsBitField(bits).toArray();
	return names.length > 0 ? names.join(', ') : '*none*';
}

export const events = [
	{
		name: Events.ChannelCreate,
		async execute(channel) {
			const embed = logEmbed(logColor.create, 'Channel created').setDescription(
				`${channelMention(channel.id)} (${channel.name})`
			);
			embed.addFields({
				name: 'Type',
				value: channelKinds[channel.type] ?? 'Channel',
				inline: true
			});
			if (channel.parent)
				embed.addFields({ name: 'Category', value: channel.parent.name, inline: true });
			await sendLog(channel.guild, 'channel_create', embed);
		}
	} satisfies Event<typeof Events.ChannelCreate>,

	{
		name: Events.ChannelUpdate,
		async execute(before, after) {
			if (before.isDMBased() || after.isDMBased()) return;
			const embed = logEmbed(logColor.update, 'Channel changed').setDescription(
				`${channelMention(after.id)} (${after.name})`
			);
			// Position is left out: dragging one channel fires an update for every channel it passes.
			let changed = addChange(embed, 'Name', before.name, after.name);
			changed = addChange(embed, 'Category', before.parent?.name, after.parent?.name) || changed;
			if ('topic' in before && 'topic' in after) {
				changed = addChange(embed, 'Topic', before.topic, after.topic) || changed;
			}
			if ('nsfw' in before && 'nsfw' in after) {
				changed =
					addChange(embed, 'Age restricted', String(before.nsfw), String(after.nsfw)) || changed;
			}
			if ('rateLimitPerUser' in before && 'rateLimitPerUser' in after) {
				const slowmode = (seconds: number | null) => (seconds ? `${seconds}s` : 'off');
				changed =
					addChange(
						embed,
						'Slowmode',
						slowmode(before.rateLimitPerUser),
						slowmode(after.rateLimitPerUser)
					) || changed;
			}
			const overwrites = (channel: typeof after) =>
				JSON.stringify(
					[...channel.permissionOverwrites.cache.values()]
						.map((o) => [o.id, o.allow.bitfield.toString(), o.deny.bitfield.toString()])
						.sort()
				);
			if (overwrites(before) !== overwrites(after)) {
				embed.addFields({ name: 'Permissions', value: 'Permission overwrites changed.' });
				changed = true;
			}
			if (changed) await sendLog(after.guild, 'channel_update', embed);
		}
	} satisfies Event<typeof Events.ChannelUpdate>,

	{
		name: Events.ChannelDelete,
		async execute(channel) {
			if (channel.isDMBased()) return;
			// A deleted channel can no longer receive logs.
			forgetLogChannel(channel.id);
			const embed = logEmbed(logColor.delete, 'Channel deleted').setDescription(`#${channel.name}`);
			embed.addFields({
				name: 'Type',
				value: channelKinds[channel.type] ?? 'Channel',
				inline: true
			});
			await sendLog(channel.guild, 'channel_delete', embed);
		}
	} satisfies Event<typeof Events.ChannelDelete>,

	{
		name: Events.GuildRoleCreate,
		async execute(role) {
			// Integration roles (for bots and boosts) are made by Discord, not a person.
			if (role.managed) return;
			const embed = logEmbed(logColor.create, 'Role created').setDescription(
				`${roleMention(role.id)} (${role.name})`
			);
			await sendLog(role.guild, 'role_create', embed);
		}
	} satisfies Event<typeof Events.GuildRoleCreate>,

	{
		name: Events.GuildRoleUpdate,
		async execute(before, after) {
			const embed = logEmbed(logColor.update, 'Role changed').setDescription(
				`${roleMention(after.id)} (${after.name})`
			);
			// Position is left out for the same reason as channels.
			let changed = addChange(embed, 'Name', before.name, after.name);
			changed = addChange(embed, 'Color', before.hexColor, after.hexColor) || changed;
			changed =
				addChange(embed, 'Shown separately', String(before.hoist), String(after.hoist)) || changed;
			changed =
				addChange(
					embed,
					'Mentionable by everyone',
					String(before.mentionable),
					String(after.mentionable)
				) || changed;
			const added = after.permissions.bitfield & ~before.permissions.bitfield;
			const removed = before.permissions.bitfield & ~after.permissions.bitfield;
			if (added) embed.addFields({ name: 'Permissions added', value: permissionNames(added) });
			if (removed)
				embed.addFields({ name: 'Permissions removed', value: permissionNames(removed) });
			if (changed || added || removed) await sendLog(after.guild, 'role_update', embed);
		}
	} satisfies Event<typeof Events.GuildRoleUpdate>,

	{
		name: Events.GuildRoleDelete,
		async execute(role) {
			if (role.managed) return;
			const embed = logEmbed(logColor.delete, 'Role deleted').setDescription(`@${role.name}`);
			await sendLog(role.guild, 'role_delete', embed);
		}
	} satisfies Event<typeof Events.GuildRoleDelete>,

	{
		name: Events.GuildUpdate,
		async execute(before, after) {
			const embed = logEmbed(logColor.update, 'Server settings changed');
			let changed = addChange(embed, 'Name', before.name, after.name);
			changed = addChange(embed, 'Description', before.description, after.description) || changed;
			changed = addChange(embed, 'Owner', `<@${before.ownerId}>`, `<@${after.ownerId}>`) || changed;
			changed =
				addChange(
					embed,
					'Verification level',
					GuildVerificationLevel[before.verificationLevel],
					GuildVerificationLevel[after.verificationLevel]
				) || changed;
			if (before.icon !== after.icon) {
				embed.addFields({ name: 'Icon', value: after.icon ? 'Changed' : 'Removed' });
				const icon = after.iconURL();
				if (icon) embed.setThumbnail(icon);
				changed = true;
			}
			if (changed) await sendLog(after, 'server_update', embed);
		}
	} satisfies Event<typeof Events.GuildUpdate>,

	{
		name: Events.GuildEmojiCreate,
		async execute(emoji) {
			const embed = logEmbed(logColor.create, 'Emoji added')
				.setDescription(`${emoji} :${emoji.name}:`)
				.setThumbnail(emoji.imageURL());
			await sendLog(emoji.guild, 'emoji_create', embed);
		}
	} satisfies Event<typeof Events.GuildEmojiCreate>,

	{
		name: Events.GuildEmojiUpdate,
		async execute(before, after) {
			const embed = logEmbed(logColor.update, 'Emoji renamed')
				.setDescription(`${after}`)
				.setThumbnail(after.imageURL());
			if (addChange(embed, 'Name', `:${before.name}:`, `:${after.name}:`)) {
				await sendLog(after.guild, 'emoji_update', embed);
			}
		}
	} satisfies Event<typeof Events.GuildEmojiUpdate>,

	{
		name: Events.GuildEmojiDelete,
		async execute(emoji) {
			const embed = logEmbed(logColor.delete, 'Emoji removed')
				.setDescription(`:${emoji.name}:`)
				.setThumbnail(emoji.imageURL());
			await sendLog(emoji.guild, 'emoji_delete', embed);
		}
	} satisfies Event<typeof Events.GuildEmojiDelete>
];
