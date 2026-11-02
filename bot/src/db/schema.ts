import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

// Discord ids are text: snowflakes exceed Number.MAX_SAFE_INTEGER, and text maps
// the same way if this ever moves to Postgres.

export const guilds = sqliteTable('guilds', {
	id: text('id').primaryKey(),
	joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull()
});

// Dashboard sign-ins. The id is a SHA-256 hash of the cookie's token, so someone
// who reads the database cannot paste a row into a cookie and sign in as that user.
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	username: text('username').notNull(),
	globalName: text('global_name'),
	avatar: text('avatar'),
	// The user's Discord OAuth token, used to list the user's servers. The session ends when
	// it expires, so there is no refresh token to keep.
	accessToken: text('access_token').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

// Which channels each event is logged to. Deleted with the server's row when Golem
// leaves, so no settings linger for servers it is no longer in.
export const logChannels = sqliteTable(
	'log_channels',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		event: text('event').notNull(),
		channelId: text('channel_id').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.guildId, table.event, table.channelId] }),
		// For removing a deleted channel from every event.
		index('log_channels_channel_id_idx').on(table.channelId)
	]
);

// Switches that change what an event's log shows, such as who invited a new member.
// A row means the switch is on.
export const logOptions = sqliteTable(
	'log_options',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		event: text('event').notNull(),
		option: text('option').notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.event, table.option] })]
);

// Who invited each member Golem traced, so "x has now invited N of our members" can
// count only people who are still here. A member's row is removed when the member leaves.
export const inviteJoins = sqliteTable(
	'invite_joins',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		memberId: text('member_id').notNull(),
		inviterId: text('inviter_id').notNull(),
		inviteCode: text('invite_code').notNull(),
		joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.guildId, table.memberId] }),
		index('invite_joins_inviter_idx').on(table.guildId, table.inviterId)
	]
);

// How many times each person has left a server, counted from when Golem started tracking
// leaves. Deleted with the server's row when Golem leaves.
export const memberLeaves = sqliteTable(
	'member_leaves',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		leaves: integer('leaves').notNull(),
		lastLeftAt: integer('last_left_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.userId] })]
);

// Invites from before Golem tracked them, added to an inviter's tracked count by hand. There
// is no command or page for this; set it in the database.
export const inviteCountAdjustments = sqliteTable(
	'invite_count_adjustments',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		inviterId: text('inviter_id').notNull(),
		extra: integer('extra').notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.inviterId] })]
);

// Every join and leave, for the dashboard's analytics. Recorded for every server from when
// this shipped; apps aren't counted.
export const memberEvents = sqliteTable(
	'member_events',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		kind: text('kind', { enum: ['join', 'leave'] }).notNull(),
		at: integer('at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [index('member_events_guild_at_idx').on(table.guildId, table.at)]
);

// Messages each member sent per day (UTC, as YYYY-MM-DD), for the dashboard's activity charts.
export const memberActivity = sqliteTable(
	'member_activity',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		day: text('day').notNull(),
		userId: text('user_id').notNull(),
		messages: integer('messages').notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.day, table.userId] })]
);

// When each current member joined, recorded on every join whether or not anything shows it,
// so "time in server" works once it is turned on. Discord also knows this for members Golem
// has cached; this covers the ones it hasn't. Removed when the member leaves.
export const memberJoins = sqliteTable(
	'member_joins',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.userId] })]
);

// The roles a member had when the member left, kept while the server restores roles on rejoin.
// Removed once the member rejoins, or for the whole server when the setting is turned off.
export const memberRoles = sqliteTable(
	'member_roles',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		// A JSON array of role ids.
		roleIds: text('role_ids', { mode: 'json' }).$type<string[]>().notNull(),
		// How the member left: 'left', 'kicked', 'banned', or 'unknown' when Golem can't read the audit
		// log to rule out a kick. Checked against the settings when the member rejoins.
		removal: text('removal', { enum: ['left', 'kicked', 'banned', 'unknown'] })
			.notNull()
			.default('left'),
		leftAt: integer('left_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.userId] })]
);

// The message Golem posts when someone joins. A missing row means it is off.
export const welcomeSettings = sqliteTable('welcome_settings', {
	guildId: text('guild_id')
		.primaryKey()
		.references(() => guilds.id, { onDelete: 'cascade' }),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	channelId: text('channel_id'),
	// A template with {variables}, listed in bot/src/lib/welcome.ts.
	message: text('message').notNull(),
	// Whether user mentions in the message ping, including {user} and {inviter}. Off until
	// turned on. Roles, @everyone and @here never ping.
	pingMentions: integer('ping_mentions', { mode: 'boolean' }).notNull().default(false)
});

// XP members earn by chatting in one server. Kept when they leave, so it comes back if
// they rejoin; deleted with the server's row when Golem leaves.
export const memberXp = sqliteTable(
	'member_xp',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		xp: integer('xp').notNull(),
		lastAwardAt: integer('last_award_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.guildId, table.userId] }),
		index('member_xp_rank_idx').on(table.guildId, table.xp)
	]
);

// XP earned across every server, with its own cooldown so being in more servers does
// not mean levelling faster.
export const userXp = sqliteTable(
	'user_xp',
	{
		userId: text('user_id').primaryKey(),
		xp: integer('xp').notNull(),
		lastAwardAt: integer('last_award_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [index('user_xp_rank_idx').on(table.xp)]
);

// Server-wide settings, one row per server. A missing row means every default.
export const guildSettings = sqliteTable('guild_settings', {
	guildId: text('guild_id')
		.primaryKey()
		.references(() => guilds.id, { onDelete: 'cascade' }),
	// Whether using Golem's slash commands earns server XP. Global XP always counts them.
	commandXp: integer('command_xp', { mode: 'boolean' }).notNull().default(true),
	// The master switch for /level, /rank and their global versions here. Off until a server
	// manager turns it on; XP is earned either way.
	levelCommands: integer('level_commands', { mode: 'boolean' }).notNull().default(false),
	// The master switch for games in this server. Off until a server manager turns it on.
	gamesEnabled: integer('games_enabled', { mode: 'boolean' }).notNull().default(false),
	// Whether members who leave get their roles back when they rejoin. Off until turned on.
	restoreRoles: integer('restore_roles', { mode: 'boolean' }).notNull().default(false),
	// Whether restoring roles also covers members who were kicked or banned. Off by default,
	// so they rejoin without roles the way Discord does it.
	restoreKicked: integer('restore_kicked', { mode: 'boolean' }).notNull().default(false),
	restoreBanned: integer('restore_banned', { mode: 'boolean' }).notNull().default(false)
});

// Chips, the currency games are played with. One balance per person, shared across
// servers and DMs. A row appears the first time someone uses chips.
export const chipBalances = sqliteTable('chip_balances', {
	userId: text('user_id').primaryKey(),
	chips: integer('chips').notNull(),
	lastDailyAt: integer('last_daily_at', { mode: 'timestamp_ms' })
});

// Chips set aside for a game that hasn't finished. Settling the game deletes the row;
// any rows left at startup belong to games a restart cut short and are refunded.
export const chipHolds = sqliteTable('chip_holds', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id').notNull(),
	game: text('game').notNull(),
	amount: integer('amount').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});

// Per-game switches under the master one. A missing row means the game is on, so turning
// games on enables every game, including ones added later.
export const guildGames = sqliteTable(
	'guild_games',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		game: text('game').notNull(),
		enabled: integer('enabled', { mode: 'boolean' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.game] })]
);

// Per-command switches under the leveling master switch. A missing row means the command
// is on, so turning leveling on enables every command.
export const guildLevelCommands = sqliteTable(
	'guild_level_commands',
	{
		guildId: text('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		command: text('command').notNull(),
		enabled: integer('enabled', { mode: 'boolean' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.guildId, table.command] })]
);

// Something Golem follows: a feed URL, a YouTube channel id, or a Twitch or Kick broadcaster
// id. Each is checked once however many servers and DMs follow it, and deleted once nothing
// does.
export const feedSources = sqliteTable(
	'feed_sources',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		kind: text('kind').notNull(),
		key: text('key').notNull(),
		title: text('title').notNull(),
		// The page people know it by, for links in the dashboard and /feed list.
		url: text('url').notNull(),
		// What the last check saw: recent item ids for feeds, the live stream for streamers.
		state: text('state', { mode: 'json' }).$type<FeedState>().notNull(),
		nextCheckAt: integer('next_check_at', { mode: 'timestamp_ms' }).notNull(),
		failures: integer('failures').notNull().default(0),
		lastError: text('last_error')
	},
	(table) => [
		uniqueIndex('feed_sources_kind_key_idx').on(table.kind, table.key),
		index('feed_sources_next_check_at_idx').on(table.nextCheckAt)
	]
);

export type FeedState = { seen?: string[]; live?: string | null };

// Where a source's posts go. In a server, channelId is the channel. In a DM, guildId is
// null and channelId is the person's user id, since Golem DMs that person directly.
export const feedSubscriptions = sqliteTable(
	'feed_subscriptions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		sourceId: integer('source_id')
			.notNull()
			.references(() => feedSources.id, { onDelete: 'cascade' }),
		guildId: text('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
		channelId: text('channel_id').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		// Why the last post here failed, like missing permissions. Cleared by the next success.
		lastError: text('last_error')
	},
	(table) => [
		uniqueIndex('feed_subscriptions_source_channel_idx').on(table.sourceId, table.channelId),
		index('feed_subscriptions_guild_id_idx').on(table.guildId),
		index('feed_subscriptions_channel_id_idx').on(table.channelId)
	]
);
