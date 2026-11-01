// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session } from '#bot/db/sessions.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session | null;
			user: {
				id: string;
				name: string;
				avatarUrl: string;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
