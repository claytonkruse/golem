import {
	channelMention,
	Events,
	roleMention,
	time,
	TimestampStyles,
	userMention
} from 'discord.js';
import { removeInviteJoin } from '../db/invite-joins.ts';
import { hasLogOption } from '../db/log-options.ts';
import { recordLeave } from '../db/member-leaves.ts';
import type { Event } from '../lib/event.ts';
import { addChange, logColor, logEmbed, sendLog, truncate, withUser } from '../lib/logging.ts';
import { forgetJoin, joinDetails } from '../lib/member-join.ts';

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
								name: 'Their invites',
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
			// Someone who left no longer counts toward their inviter's members.
			removeInviteJoin(member.guild.id, member.id);
			forgetJoin(member);
			// Golem itself leaving is handled by GuildDelete, which deletes the server's rows.
			if (member.id !== member.client.user.id) recordLeave(member.guild.id, member.id);
			const embed = withUser(logEmbed(logColor.delete, 'Member left'), member.user).setDescription(
				`${userMention(member.id)} (${member.user.username})`
			);
			// Discord does not say whether someone left or was kicked; bans are logged separately.
			if (member.joinedAt) {
				embed.addFields({
					name: 'Joined',
					value: time(member.joinedAt, TimestampStyles.RelativeTime)
				});
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
