import { managedGuild } from '#lib/server/guilds.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	guild: await managedGuild(event, event.params.guild)
});
