import { managedGuilds } from '#lib/server/guilds.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	guilds: await managedGuilds(event)
});
