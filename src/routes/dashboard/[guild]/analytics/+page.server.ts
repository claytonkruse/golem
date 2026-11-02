import { guildAnalytics } from '#bot/db/analytics.ts';
import { inviterLeaderboard } from '#bot/db/invite-joins.ts';
import { avatarUrl, fetchGuildInvites, fetchUsers, type DiscordUser } from '#lib/server/discord.js';
import { joinedGuild } from '#lib/server/guilds.js';
import type { PageServerLoad } from './$types';

const ranges = [7, 30, 90] as const;
const TOP_INVITES = 5;
const TOP_INVITERS = 10;

function person(id: string, user: DiscordUser | undefined) {
	return {
		id,
		name: user ? (user.global_name ?? user.username) : 'Unknown user',
		username: user?.username ?? null,
		avatar: avatarUrl(user ?? { id, avatar: null })
	};
}

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	const asked = Number(event.url.searchParams.get('days'));
	const days = ranges.find((range) => range === asked) ?? 30;

	const invites = await fetchGuildInvites(guild.id);
	const topInvites = (invites ?? [])
		.filter((invite) => invite.uses > 0)
		.sort((a, b) => b.uses - a.uses)
		.slice(0, TOP_INVITES);

	const leaderboard = inviterLeaderboard(guild.id).slice(0, TOP_INVITERS);
	const users = await fetchUsers(leaderboard.map((entry) => entry.inviterId));

	return {
		days,
		ranges,
		analytics: guildAnalytics(guild.id, days),
		// null when Golem can't list invites without Manage Server.
		topInvites:
			invites === null
				? null
				: topInvites.map((invite) => ({
						code: invite.code,
						uses: invite.uses,
						inviter: invite.inviter ? person(invite.inviter.id, invite.inviter) : null
					})),
		topInviters: leaderboard.map((entry) => ({
			rank: entry.rank,
			invites: entry.invites,
			...person(entry.inviterId, users.get(entry.inviterId))
		}))
	};
};
