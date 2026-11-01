import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { db } from './index.ts';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export function migrateDatabase(): void {
	migrate(db, { migrationsFolder });
}
