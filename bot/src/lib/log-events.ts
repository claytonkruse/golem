// Every event Golem can log. The keys are stored in the database and are slash
// command choice values, so rename a label freely but never a key.

export const logGroups = [
	{ id: 'server', label: 'Server changes' },
	{ id: 'moderation', label: 'Moderation' },
	{ id: 'members', label: 'Members' },
	{ id: 'messages', label: 'Messages' }
] as const;

export type LogGroup = (typeof logGroups)[number]['id'];

export const logEvents = [
	{
		key: 'channel_create',
		group: 'server',
		label: 'Channel created',
		description: 'A channel is created.'
	},
	{
		key: 'channel_update',
		group: 'server',
		label: 'Channel changed',
		description:
			'A channel is renamed or its topic, category, slowmode, age restriction or permissions change.'
	},
	{
		key: 'channel_delete',
		group: 'server',
		label: 'Channel deleted',
		description: 'A channel is deleted.'
	},
	{ key: 'role_create', group: 'server', label: 'Role created', description: 'A role is created.' },
	{
		key: 'role_update',
		group: 'server',
		label: 'Role changed',
		description: "A role's name, color, permissions or display settings change."
	},
	{ key: 'role_delete', group: 'server', label: 'Role deleted', description: 'A role is deleted.' },
	{
		key: 'server_update',
		group: 'server',
		label: 'Server settings changed',
		description: 'The server name, icon, description, owner or verification level changes.'
	},
	{
		key: 'emoji_create',
		group: 'server',
		label: 'Emoji added',
		description: 'A custom emoji is uploaded.'
	},
	{
		key: 'emoji_update',
		group: 'server',
		label: 'Emoji renamed',
		description: 'A custom emoji is renamed.'
	},
	{
		key: 'emoji_delete',
		group: 'server',
		label: 'Emoji removed',
		description: 'A custom emoji is deleted.'
	},
	{
		key: 'member_ban',
		group: 'moderation',
		label: 'Member banned',
		description: 'Someone is banned.'
	},
	{
		key: 'member_unban',
		group: 'moderation',
		label: 'Member unbanned',
		description: 'A ban is lifted.'
	},
	{
		key: 'member_timeout',
		group: 'moderation',
		label: 'Member timed out',
		description: 'A timeout is given or its length is changed.'
	},
	{
		key: 'member_untimeout',
		group: 'moderation',
		label: 'Timeout lifted',
		description:
			"A moderator ends a timeout early. Timeouts that run out on their own aren't logged, because Discord doesn't report them."
	},
	{
		key: 'message_bulk_delete',
		group: 'moderation',
		label: 'Messages purged',
		description: 'Many messages are deleted at once, with /purge or another moderation bot.'
	},
	{
		key: 'member_join',
		group: 'members',
		label: 'Member joined',
		description: 'Someone joins the server.'
	},
	{
		key: 'member_leave',
		group: 'members',
		label: 'Member left',
		description: 'Someone leaves or is kicked or banned.'
	},
	{
		key: 'member_nickname',
		group: 'members',
		label: 'Nickname changed',
		description: "A member's server nickname changes."
	},
	{
		key: 'member_roles',
		group: 'members',
		label: 'Member roles changed',
		description: 'Roles are given to or taken from a member.'
	},
	{
		key: 'message_delete',
		group: 'messages',
		label: 'Message deleted',
		description: 'A message is deleted, with its text when Golem saw it arrive.'
	},
	{
		key: 'message_edit',
		group: 'messages',
		label: 'Message edited',
		description: 'A message is edited, with the text before and after.'
	},
	{
		key: 'thread_create',
		group: 'messages',
		label: 'Thread created',
		description: 'A thread or forum post is started.'
	},
	{
		key: 'thread_delete',
		group: 'messages',
		label: 'Thread deleted',
		description: 'A thread or forum post is deleted.'
	}
] as const satisfies readonly {
	key: string;
	group: LogGroup;
	label: string;
	description: string;
}[];

export type LogEventKey = (typeof logEvents)[number]['key'];

const keys = new Set<string>(logEvents.map((event) => event.key));

export function isLogEventKey(value: string): value is LogEventKey {
	return keys.has(value);
}

export function logEventLabel(key: LogEventKey): string {
	return logEvents.find((event) => event.key === key)?.label ?? key;
}

// Extra switches some events have. Keys are stored in the database like event keys.
export type LogOption = {
	key: string;
	label: string;
	description: string;
	// Only applies while this other option is on.
	requires?: string;
	// 'requirement' marks a description that says what the option needs to work, rather
	// than extra information, and the dashboard shows it as a warning.
	note?: 'info' | 'requirement';
};

export const logEventOptions: Partial<Record<LogEventKey, LogOption[]>> = {
	member_join: [
		{
			key: 'show_inviter',
			label: 'Show who invited them',
			note: 'requirement',
			description:
				'Golem needs the Manage Server permission for this, since Discord only shows invites to members who have it.'
		},
		{
			key: 'show_invite_count',
			label: 'Show how many members the inviter has brought in',
			description:
				'Counts people they invited who are still in the server, from when Golem started tracking invites here.',
			requires: 'show_inviter'
		},
		{
			key: 'show_leave_count',
			label: 'Show how many times they left before',
			description:
				"Counts leaves Golem has seen, so leaves before Golem tracked them or while it was offline aren't included."
		}
	]
};

export function isLogOption(event: LogEventKey, option: string): boolean {
	return logEventOptions[event]?.some((entry) => entry.key === option) ?? false;
}
