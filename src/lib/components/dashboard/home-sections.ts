import { resolve } from '$app/paths';
import Rss from '@tabler/icons-svelte/icons/rss';
import Server from '@tabler/icons-svelte/icons/server';

// The second column next to Golem's logo in the rail: the person's own pages, not a server's.
export function homeSections() {
	return [
		{ href: resolve('dashboard/'), label: 'Your servers', icon: Server },
		{ href: resolve('dashboard/feeds/'), label: 'Your feeds', icon: Rss }
	];
}
