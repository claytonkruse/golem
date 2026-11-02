import { userMention, type GuildMember, type PartialGuildMember } from 'discord.js';
import { countInvitedMembers, recordInviteJoin } from '../db/invite-joins.ts';
import { countLeaves } from '../db/member-leaves.ts';
import { hasLogOption } from '../db/log-options.ts';
import { welcomeUsesInvites } from '../db/welcome.ts';
import { findInvite, type InviteResult } from './invites.ts';
import type { WelcomeValues } from './welcome.ts';

// What the join log and the welcome message both want to know about a new member. Working
// out the invite reads the server's invite counts, which only works once per join, so both
// handlers share one lookup.

export type JoinDetails = {
	// Null when nothing here needs invites, or for apps, which aren't added through one.
	invite: InviteResult | null;
	// Members the inviter has brought in who are still here, counting this one.
	inviterCount: number | null;
	// Times they left this server before, as far as Golem has seen.
	leaves: number;
};

const FORGET_AFTER_MS = 10_000;
const pending = new Map<string, Promise<JoinDetails>>();

const keyOf = (member: GuildMember | PartialGuildMember) => `${member.guild.id}:${member.id}`;

// Servers where some setting needs to know which invite someone used.
export function tracksInvites(guildId: string): boolean {
	return hasLogOption(guildId, 'member_join', 'show_inviter') || welcomeUsesInvites(guildId);
}

async function lookUp(member: GuildMember): Promise<JoinDetails> {
	const leaves = countLeaves(member.guild.id, member.id);
	if (member.user.bot || !tracksInvites(member.guild.id)) {
		return { invite: null, inviterCount: null, leaves };
	}
	const invite = await findInvite(member.guild);
	let inviterCount: number | null = null;
	if (invite.kind === 'invite' && invite.inviterId) {
		recordInviteJoin(member.guild.id, member.id, invite.inviterId, invite.code);
		inviterCount = countInvitedMembers(member.guild.id, invite.inviterId);
	}
	return { invite, inviterCount, leaves };
}

export function joinDetails(member: GuildMember): Promise<JoinDetails> {
	const key = keyOf(member);
	const existing = pending.get(key);
	if (existing) return existing;
	const details = lookUp(member);
	pending.set(key, details);
	setTimeout(() => {
		if (pending.get(key) === details) pending.delete(key);
	}, FORGET_AFTER_MS).unref();
	return details;
}

// A quick leave and rejoin is a new join, not the one just looked up.
export function forgetJoin(member: GuildMember | PartialGuildMember): void {
	pending.delete(keyOf(member));
}

// The welcome message variables for this member.
export function welcomeValues(member: GuildMember, details: JoinDetails): WelcomeValues {
	const invite = details.invite;
	let inviter = 'someone';
	if (invite?.kind === 'invite' && invite.inviterId) inviter = userMention(invite.inviterId);
	else if (invite?.kind === 'vanity') inviter = 'the vanity link';
	return {
		user: userMention(member.id),
		username: member.user.username,
		server: member.guild.name,
		membercount: String(member.guild.memberCount),
		inviter,
		invitecount: details.inviterCount === null ? '?' : String(details.inviterCount),
		leavecount: String(details.leaves)
	};
}
