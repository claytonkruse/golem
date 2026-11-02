import {
	channelMention,
	Events,
	roleMention,
	time,
	TimestampStyles,
	userMention
} from 'discord.js';
import { countInvitedMembers, getInviteJoin, removeInviteJoin } from '../db/invite-joins.ts';
import { hasLogOption } from '../db/log-options.ts';
import { takeJoin } from '../db/member-joins.ts';
import { countLeaves, recordLeave } from '../db/member-leaves.ts';
import type { Event } from '../lib/event.ts';
import { addChange, logColor, logEmbed, sendLog, truncate, withUser } from '../lib/logging.ts';
import { forgetJoin, joinDetails } from '../lib/member-join.ts';

const UNITS = [
	['year', 365 * 24 * 60 * 60 * 1000],
	['day', 24 * 60 * 60 * 1000],
	['hour', 60 * 60 * 1000],
	['minute', 60 * 1000]
] as const;

// The two largest units, like "1 year, 12 days" or "3 hours, 5 minutes".
function duration(ms: number): string {
	const parts: string[] = [];
	let rest = ms;
	for (const [unit, size] of UNITS) {
		const amount = Math.floor(rest / size);
		rest -= amount * size;
		if (amount > 0 || parts.length > 0) parts.push(`${amount} ${unit}${amount === 1 ? '' : 's'}`);
		if (parts.length === 2) break;
	}
	const shown = parts.filter((part) => !part.startsWith('0 '));
	return shown.length > 0 ? shown.join(', ') : 'Less than a minute';
}

function timesLeft(leaves: number): string {
	if (leaves === 0) return 'Never';
	return leaves === 1 ? 'Once' : `${leaves} times`;
}

export const events = [
	{
		name: Events.GuildBanAdd,
		async execute(ban) {
			const embed = withUser(logEmbed(logColor.delete, 'Member banned'), ban.user).setDescription(
				`${userMention(ban.user.id)} (${ban.user.username})`
			);
			if (ban.reason) embed.addFields({ name: 'Reason', value: truncate(ban.reason, 1024) });
			await sendLog(ban.guild, 'member_ban', embed);
		}
	} satisfies Event<typeof Events.GuildBanAdd>,

	{
		name: Events.GuildBanRemove,
		async execute(ban) {
			const embed = withUser(logEmbed(logColor.create, 'Member unbanned'), ban.user).setDescription(
				`${userMention(ban.user.id)} (${ban.user.username})`
			);
			await sendLog(ban.guild, 'member_unban', embed);
		}
	} satisfies Event<typeof Events.GuildBanRemove>,

	{
		name: Events.GuildMemberAdd,
		async execute(member) {
			const embed = withUser(logEmbed(logColor.create, 'Member joined'), member.user)
				.setDescription(`${userMention(member.id)} (${member.user.username})`)
				.addFields({
					name: 'Account created',
					value: time(member.user.createdAt, TimestampStyles.RelativeTime)
				});

			// Runs even when nothing is logged yet, to keep the invite counts current.
			const details = await joinDetails(member);
			if (hasLogOption(member.guild.id, 'member_join', 'show_inviter')) {
				const invite = details.invite;
				if (member.user.bot || !invite) {
					embed.addFields({ name: 'Invited by', value: 'Added as an app, not through an invite' });
				} else {
					if (invite.kind === 'invite') {
						const inviter = invite.inviterId ? userMention(invite.inviterId) : 'Unknown';
						embed.addFields({
							name: 'Invited by',
							value: `${inviter} with \`${invite.code}\``,
							inline: true
						});
						if (
							details.inviterCount !== null &&
							hasLogOption(member.guild.id, 'member_join', 'show_invite_count')
						) {
							embed.addFields({
								name: "Inviter's invites",
								value: `${inviter} has now invited ${details.inviterCount} of our members.`
							});
						}
					} else if (invite.kind === 'vanity') {
						embed.addFields({
							name: 'Invited by',
							value: `The server's vanity link, \`${invite.code}\``
						});
					} else {
						embed.addFields({ name: 'Invited by', value: `Unknown. ${invite.reason}` });
					}
				}
			}
			if (hasLogOption(member.guild.id, 'member_join', 'show_leave_count')) {
				embed.addFields({ name: 'Left before', value: timesLeft(details.leaves) });
			}

			await sendLog(member.guild, 'member_join', embed);
		}
	} satisfies Event<typeof Events.GuildMemberAdd>,

	{
		name: Events.GuildMemberRemove,
		async execute(member) {
			const guildId = member.guild.id;
			// Read before the rows below are cleared. Discord's join date needs the member cached.
			const joinedAt = takeJoin(guildId, member.id) ?? member.joinedAt;
			const inviteJoin = getInviteJoin(guildId, member.id);
			// A member who left no longer counts toward the inviter's members.
			removeInviteJoin(guildId, member.id);
			forgetJoin(member);
			// Golem itself leaving is handled by GuildDelete, which deletes the server's rows.
			if (member.id !== member.client.user.id) recordLeave(guildId, member.id);
			const embed = withUser(logEmbed(logColor.delete, 'Member left'), member.user).setDescription(
				`${userMention(member.id)} (${member.user.username})`
			);
			// Discord does not say whether someone left or was kicked; bans are logged separately.
			if (joinedAt) {
				embed.addFields({
					name: 'Joined',
					value: time(joinedAt, TimestampStyles.RelativeTime),
					inline: true
				});
				if (hasLogOption(guildId, 'member_leave', 'show_time_in_server')) {
					embed.addFields({
						name: 'Time in server',
						value: duration(Date.now() - joinedAt.getTime()),
						inline: true
					});
				}
			}
			if (hasLogOption(guildId, 'member_leave', 'show_inviter') && !member.user.bot) {
				if (inviteJoin) {
					const inviter = userMention(inviteJoin.inviterId);
					embed.addFields({
						name: 'Invited by',
						value: `${inviter} with \`${inviteJoin.inviteCode}\``
					});
					if (hasLogOption(guildId, 'member_leave', 'show_invite_count')) {
						const count = countInvitedMembers(guildId, inviteJoin.inviterId);
						embed.addFields({
							name: "Inviter's invites",
							value: `${inviter} now has ${count} invited ${count === 1 ? 'member' : 'members'} still here.`
						});
					}
				} else {
					embed.addFields({
						name: 'Invited by',
						value: 'Unknown, or through the vanity link. Golem only knows invites it tracked.'
					});
				}
			}
			if (hasLogOption(guildId, 'member_leave', 'show_leave_count')) {
				embed.addFields({ name: 'Times left', value: timesLeft(countLeaves(guildId, member.id)) });
			}
			const roles = member.roles.cache.filter((role) => role.id !== member.guild.id);
			if (roles.size > 0) {
				embed.addFields({
					name: 'Roles',
					value: truncate(roles.map((role) => roleMention(role.id)).join(' '), 1024)
				});
			}
			await sendLog(member.guild, 'member_leave', embed);
		}
	} satisfies Event<typeof Events.GuildMemberRemove>,

	{
		// One update can be a nickname, role and timeout change at once; each is its own log event.
		name: Events.GuildMemberUpdate,
		async execute(before, after) {
			// Without the earlier state there is nothing to compare against.
			if (before.partial) return;
			const who = `${userMention(after.id)} (${after.user.username})`;
			const sends: Promise<void>[] = [];

			const nickname = withUser(
				logEmbed(logColor.update, 'Nickname changed'),
				after.user
			).setDescription(who);
			if (addChange(nickname, 'Nickname', before.nickname, after.nickname)) {
				sends.push(sendLog(after.guild, 'member_nickname', nickname));
			}

			const added = after.roles.cache.filter((role) => !before.roles.cache.has(role.id));
			const removed = before.roles.cache.filter((role) => !after.roles.cache.has(role.id));
			if (added.size > 0 || removed.size > 0) {
				const roles = withUser(
					logEmbed(logColor.update, 'Member roles changed'),
					after.user
				).setDescription(who);
				if (added.size > 0)
					roles.addFields({
						name: 'Added',
						value: added.map((role) => roleMention(role.id)).join(' ')
					});
				if (removed.size > 0) {
					roles.addFields({
						name: 'Removed',
						value: removed.map((role) => roleMention(role.id)).join(' ')
					});
				}
				sends.push(sendLog(after.guild, 'member_roles', roles));
			}

			const until = after.communicationDisabledUntil;
			const wasUntil = before.communicationDisabledUntil;
			if (until?.getTime() !== wasUntil?.getTime()) {
				const timedOut = until !== null && until.getTime() > Date.now();
				const timeout = withUser(
					logEmbed(
						timedOut ? logColor.delete : logColor.create,
						timedOut ? 'Member timed out' : 'Timeout lifted'
					),
					after.user
				).setDescription(who);
				if (timedOut)
					timeout.addFields({ name: 'Until', value: time(until, TimestampStyles.LongDateTime) });
				sends.push(sendLog(after.guild, timedOut ? 'member_timeout' : 'member_untimeout', timeout));
			}

			await Promise.all(sends);
		}
	} satisfies Event<typeof Events.GuildMemberUpdate>,

	{
		name: Events.MessageBulkDelete,
		async execute(messages, channel) {
			const embed = logEmbed(logColor.delete, 'Messages purged').setDescription(
				`${messages.size} messages deleted in ${channelMention(channel.id)}`
			);
			// Authors are only known for messages Golem saw arrive.
			const authors = [...new Set(messages.map((message) => message.author?.id))].filter(
				(id): id is string => id !== undefined
			);
			if (authors.length > 0) {
				embed.addFields({
					name: 'From',
					value: truncate(authors.map((id) => userMention(id)).join(' '), 1024)
				});
			}
			await sendLog(channel.guild, 'message_bulk_delete', embed);
		}
	} satisfies Event<typeof Events.MessageBulkDelete>
];
