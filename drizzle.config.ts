import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'sqlite',
	schema: './bot/src/db/schema.ts',
	out: './bot/drizzle',
	dbCredentials: { url: process.env.DATABASE_PATH || 'data/golem.db' }
});
