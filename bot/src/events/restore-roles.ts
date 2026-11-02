import { AuditLogEvent, Events, PermissionFlagsBits, type Client, type Guild } from 'discord.js';
import {
	getGuildSettings,
	guildsRestoringRoles,
	type GuildSettings
} from '../db/guild-settings.ts';
import { saveRoles, takeRoles, type Removal } from '../db/member-roles.ts';
import type { Event } from '../lib/event.ts';

// Discord does not say which roles a member had when the member leaves, so Golem needs them cached
// beforehand. Servers that turn this on have their members loaded within a few minutes.
const LOAD_INTERVAL = 5 * 60 * 1000;
const loaded = new Set<string>();

async function loadMembers(client: Client): Promise<void> {
	for (const guildId of guildsRestoringRoles()) {
		const guild = client.guilds.cache.get(guildId);
		if (!guild || loaded.has(guildId)) continue;
		try {
			await guild.members.fetch();
			loaded.add(guildId);
		} catch (error) {
			console.error(`Could not load the members of ${guildId} to restore roles.`, error);
		}
	}
}

// Discord reports leaving, kicks and bans the same way. Bans also send their own event, which
// can arrive just before or after the member is removed, so the removal waits for it.
const SETTLE_DELAY = 2000;
// How far back an audit log entry can be and still be this removal.
const AUDIT_WINDOW = 15_000;
const recentBans = new Map<string, number>();

function banKey(guildId: string, userId: string): string {
	return `${guildId}:${userId}`;
}

async function removalOf(guild: Guild, userId: string, removedAt: number): Promise<Removal> {
	await new Promise((resolve) => setTimeout(resolve, SETTLE_DELAY));
	if (recentBans.has(banKey(guild.id, userId))) return 'banned';
	if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return 'unknown';
	try {
		const kicks = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
		const kicked = kicks.entries.some(
			(entry) => entry.targetId === userId && entry.createdTimestamp > removedAt - AUDIT_WINDOW
		);
		return kicked ? 'kicked' : 'left';
	} catch {
		return 'unknown';
	}
}

// Leaving always restores. 'unknown' could have been a kick, so it follows the kick switch.
function restores(settings: GuildSettings, removal: Removal): boolean {
	if (removal === 'left') return true;
	if (removal === 'banned') return settings.restoreBanned;
	return settings.restoreKicked;
}

export const events = [
	{
		name: Events.ClientReady,
		once: true,
		execute(client) {
			const load = () =>
				loadMembers(client).catch((error: unknown) => {
					console.error('Could not load members to restore roles.', error);
				});
			void load();
			setInterval(load, LOAD_INTERVAL).unref();
		}
	} satisfies Event<typeof Events.ClientReady>,

	{
		name: Events.GuildBanAdd,
		execute(ban) {
			const key = banKey(ban.guild.id, ban.user.id);
			recentBans.set(key, Date.now());
			setTimeout(() => recentBans.delete(key), AUDIT_WINDOW).unref();
		}
	} satisfies Event<typeof Events.GuildBanAdd>,

	{
		name: Events.GuildMemberRemove,
		async execute(member) {
			// A member Golem never cached comes without roles; saving none would lose nothing.
			if (member.partial || member.id === member.client.user.id) return;
			if (!getGuildSettings(member.guild.id).restoreRoles) return;
			// @everyone and roles that belong to an app or boosting can't be given back by hand.
			const roleIds = member.roles.cache
				.filter((role) => role.id !== member.guild.id && !role.managed)
				.map((role) => role.id);
			if (roleIds.length === 0) return;
			// Saved however the member left, so changing the switches later applies to it.
			const removal = await removalOf(member.guild, member.id, Date.now());
			saveRoles(member.guild.id, member.id, { roleIds, removal });
		}
	} satisfies Event<typeof Events.GuildMemberRemove>,

	{
		name: Events.GuildMemberAdd,
		async execute(member) {
			const settings = getGuildSettings(member.guild.id);
			if (!settings.restoreRoles) return;
			const saved = takeRoles(member.guild.id, member.id);
			if (!saved || !restores(settings, saved.removal)) return;
			// Only roles that still exist and sit below Golem's highest role, with Manage Roles.
			const roles = saved.roleIds.flatMap((id) => {
				const role = member.guild.roles.cache.get(id);
				return role?.editable && !role.managed ? [role] : [];
			});
			if (roles.length === 0) return;
			try {
				await member.roles.add(roles, 'Restoring the roles the member had before leaving');
			} catch (error) {
				console.error(`Could not restore roles in ${member.guild.id}.`, error);
			}
		}
	} satisfies Event<typeof Events.GuildMemberAdd>
];
