import { databasePath } from './db/index.ts';
import { migrateDatabase } from './db/migrate.ts';

try {
	migrateDatabase();
	console.log(`Migrated ${databasePath}.`);
} catch (error) {
	console.error('Failed to migrate the database.', error);
	process.exit(1);
}
