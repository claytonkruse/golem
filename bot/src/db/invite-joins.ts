import { and, count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { inviteJoins } from './schema.ts';

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

export function removeInviteJoin(guildId: string, memberId: string): void {
	db.delete(inviteJoins)
		.where(and(eq(inviteJoins.guildId, guildId), eq(inviteJoins.memberId, memberId)))
		.run();
}

// Members this person invited who are still in the server.
export function countInvitedMembers(guildId: string, inviterId: string): number {
	return (
		db
			.select({ value: count() })
			.from(inviteJoins)
			.where(and(eq(inviteJoins.guildId, guildId), eq(inviteJoins.inviterId, inviterId)))
			.get()?.value ?? 0
	);
}
