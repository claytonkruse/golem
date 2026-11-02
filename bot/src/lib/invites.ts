import { PermissionFlagsBits, type Guild } from 'discord.js';

// Discord does not say which invite someone used. Golem keeps each server's invite use
// counts and, when someone joins, reads them again: the invite whose count went up is
// the one the member used. Only servers with "Show who invited the member" on are tracked.

type InviteSnapshot = {
	uses: number;
	maxUses: number;
	inviterId: string | null;
};

type Snapshot = Map<string, InviteSnapshot>;

export type InviteResult =
	| { kind: 'invite'; code: string; inviterId: string | null }
	| { kind: 'vanity'; code: string }
	| { kind: 'unknown'; reason: string };

const VANITY = 'vanity';
const snapshots = new Map<string, Snapshot>();
// One join at a time per server, so two quick joins are compared against the right counts.
const queues = new Map<string, Promise<unknown>>();

function canReadInvites(guild: Guild): boolean {
	return guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
}

async function readInvites(guild: Guild): Promise<Snapshot> {
	const snapshot: Snapshot = new Map();
	for (const invite of (await guild.invites.fetch({ cache: false })).values()) {
		snapshot.set(invite.code, {
			uses: invite.uses ?? 0,
			maxUses: invite.maxUses ?? 0,
			inviterId: invite.inviterId
		});
	}
	if (guild.vanityURLCode) {
		const vanity = await guild.fetchVanityData();
		snapshot.set(VANITY, { uses: vanity.uses, maxUses: 0, inviterId: null });
	}
	return snapshot;
}

// Records a server's current counts so the next join has something to compare with.
export async function primeInvites(guild: Guild): Promise<void> {
	if (!canReadInvites(guild)) return;
	try {
		snapshots.set(guild.id, await readInvites(guild));
	} catch (error) {
		console.error(`Could not read invites for ${guild.id}.`, error);
	}
}

export function forgetInvites(guildId: string): void {
	snapshots.delete(guildId);
}

// The invites whose use count went up between two snapshots.
function usedInvites(before: Snapshot, after: Snapshot): string[] {
	const used: string[] = [];
	for (const [code, now] of after) {
		const was = before.get(code)?.uses ?? 0;
		if (now.uses > was) used.push(code);
	}
	// An invite that reaches its use limit is deleted by Discord as the member joins.
	for (const [code, was] of before) {
		if (!after.has(code) && was.maxUses > 0 && was.uses + 1 >= was.maxUses) used.push(code);
	}
	return used;
}

async function resolve(guild: Guild): Promise<InviteResult> {
	if (!canReadInvites(guild)) {
		forgetInvites(guild.id);
		return { kind: 'unknown', reason: 'Golem needs the Manage Server permission to see invites.' };
	}
	const before = snapshots.get(guild.id);
	let after: Snapshot;
	try {
		after = await readInvites(guild);
	} catch (error) {
		console.error(`Could not read invites for ${guild.id}.`, error);
		return { kind: 'unknown', reason: 'Discord did not return the invite list.' };
	}
	snapshots.set(guild.id, after);

	if (!before) {
		return { kind: 'unknown', reason: 'Golem started tracking invites with this join.' };
	}
	const used = usedInvites(before, after);
	if (used.length > 1) {
		return { kind: 'unknown', reason: 'Several invites were used at once.' };
	}
	const code = used[0];
	if (code === undefined) {
		return {
			kind: 'unknown',
			reason: 'No invite use was recorded, so the member may have joined through Server Discovery.'
		};
	}
	if (code === VANITY) return { kind: 'vanity', code: guild.vanityURLCode ?? 'vanity' };

	const inviterId = (after.get(code) ?? before.get(code))?.inviterId ?? null;
	return { kind: 'invite', code, inviterId };
}

export function findInvite(guild: Guild): Promise<InviteResult> {
	const previous = queues.get(guild.id) ?? Promise.resolve();
	const next = previous.then(() => resolve(guild));
	const settled = next.catch(() => undefined);
	queues.set(guild.id, settled);
	void settled.then(() => {
		if (queues.get(guild.id) === settled) queues.delete(guild.id);
	});
	return next;
}
