import { Events, type GuildMember } from 'discord.js';
import { forgetJoinRole, getGuildSettings } from '../db/guild-settings.ts';
import type { Event } from '../lib/event.ts';

// Gives the server's join role to new members. Apps are skipped. Members who still have to
// accept the server's rules get it once they do, like Discord's own onboarding roles.
async function giveJoinRole(member: GuildMember): Promise<void> {
	const roleId = getGuildSettings(member.guild.id).joinRoleId;
	if (!roleId || member.roles.cache.has(roleId)) return;
	const role = member.guild.roles.cache.get(roleId);
	// Golem needs Manage Roles and the role below its own highest role.
	if (!role?.editable || role.managed) return;
	try {
		await member.roles.add(role, 'Join role');
	} catch (error) {
		console.error(`Could not give the join role in ${member.guild.id}.`, error);
	}
}

export const events = [
	{
		name: Events.GuildMemberAdd,
		async execute(member) {
			if (member.user.bot || member.pending) return;
			await giveJoinRole(member);
		}
	} satisfies Event<typeof Events.GuildMemberAdd>,

	{
		name: Events.GuildMemberUpdate,
		async execute(before, after) {
			// Accepting the rules flips pending off. Only a cached `before` says the member was
			// pending; an uncached one could be any update to someone who has been here for years.
			if (after.user.bot || after.pending || before.pending !== true) return;
			await giveJoinRole(after);
		}
	} satisfies Event<typeof Events.GuildMemberUpdate>,

	{
		name: Events.GuildRoleDelete,
		execute(role) {
			forgetJoinRole(role.id);
		}
	} satisfies Event<typeof Events.GuildRoleDelete>
];
