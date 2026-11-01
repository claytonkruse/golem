import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from './schema.ts';

// The bot, the dashboard and the scripts all open this file. Relative paths
// resolve from the working directory, which is the repo root for every pnpm script.
export const databasePath = path.resolve(process.env.DATABASE_PATH?.trim() || 'data/golem.db');

mkdirSync(path.dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
// WAL lets the bot and the dashboard read while the other writes. busy_timeout makes
// a writer wait for the lock instead of failing with SQLITE_BUSY.
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
