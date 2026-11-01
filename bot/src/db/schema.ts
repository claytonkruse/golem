import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
	// The user's Discord OAuth token, used to list their servers. The session ends when
	// it expires, so there is no refresh token to keep.
	accessToken: text('access_token').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});
