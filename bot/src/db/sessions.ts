import { eq, lt } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './index.ts';
import { sessions } from './schema.ts';

export type Session = typeof sessions.$inferSelect;
export type NewSession = Omit<Session, 'id'>;

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

// Returns the token for the cookie. Only its hash is stored.
export function createSession(session: NewSession): string {
	const token = randomBytes(32).toString('base64url');
	db.insert(sessions)
		.values({ ...session, id: hashToken(token) })
		.run();
	return token;
}

export function findSession(token: string): Session | undefined {
	const session = db
		.select()
		.from(sessions)
		.where(eq(sessions.id, hashToken(token)))
		.get();
	if (session && session.expiresAt.getTime() <= Date.now()) {
		deleteSession(token);
		return undefined;
	}
	return session;
}

export function deleteSession(token: string): void {
	db.delete(sessions)
		.where(eq(sessions.id, hashToken(token)))
		.run();
}

export function deleteExpiredSessions(): void {
	db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}
