import { and, count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { inviteCountAdjustments, inviteJoins } from './schema.ts';

// Someone who leaves and rejoins through another invite counts for the newer inviter.
export function recordInviteJoin(
	guildId: string,
	memberId: string,
	inviterId: string,
	inviteCode: string
): void {
	const joinedAt = new Date();
	db.insert(inviteJoins)
		.values({ guildId, memberId, inviterId, inviteCode, joinedAt })
		.onConflictDoUpdate({
			target: [inviteJoins.guildId, inviteJoins.memberId],
			set: { inviterId, inviteCode, joinedAt }
		})
		.run();
}

export function getInviteJoin(
	guildId: string,
	memberId: string
): { inviterId: string; inviteCode: string } | null {
	return (
		db
			.select({ inviterId: inviteJoins.inviterId, inviteCode: inviteJoins.inviteCode })
			.from(inviteJoins)
			.where(and(eq(inviteJoins.guildId, guildId), eq(inviteJoins.memberId, memberId)))
			.get() ?? null
	);
}

export function removeInviteJoin(guildId: string, memberId: string): void {
	db.delete(inviteJoins)
		.where(and(eq(inviteJoins.guildId, guildId), eq(inviteJoins.memberId, memberId)))
		.run();
}

// Members this inviter brought in who are still in the server, plus any invites from before
// Golem tracked them.
export function countInvitedMembers(guildId: string, inviterId: string): number {
	const tracked =
		db
			.select({ value: count() })
			.from(inviteJoins)
			.where(and(eq(inviteJoins.guildId, guildId), eq(inviteJoins.inviterId, inviterId)))
			.get()?.value ?? 0;
	const extra =
		db
			.select({ extra: inviteCountAdjustments.extra })
			.from(inviteCountAdjustments)
			.where(
				and(
					eq(inviteCountAdjustments.guildId, guildId),
					eq(inviteCountAdjustments.inviterId, inviterId)
				)
			)
			.get()?.extra ?? 0;
	return tracked + extra;
}
