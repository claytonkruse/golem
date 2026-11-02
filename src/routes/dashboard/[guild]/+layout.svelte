<script lang="ts">
	import { resolve } from '$app/paths';
	import ChannelSidebar from '#lib/components/dashboard/channel-sidebar.svelte';
	import DeviceGamepad2 from '@tabler/icons-svelte/icons/device-gamepad-2';
	import ListDetails from '@tabler/icons-svelte/icons/list-details';
	import TrendingUp from '@tabler/icons-svelte/icons/trending-up';

	let { data, children } = $props();

	// The server's settings pages, listed like Discord's channels. A server without Golem
	// has none yet.
	const sections = $derived(
		data.guild.joinedAt
			? [
					{
						href: resolve(`dashboard/${data.guild.id}/logging/`),
						label: 'Logging',
						icon: ListDetails
					},
					{
						href: resolve(`dashboard/${data.guild.id}/leveling/`),
						label: 'Leveling',
						icon: TrendingUp
					},
					{
						href: resolve(`dashboard/${data.guild.id}/games/`),
						label: 'Games',
						icon: DeviceGamepad2
					}
				]
			: []
	);
</script>

<svelte:head>
	<title>{data.guild.name} · Golem</title>
</svelte:head>

<ChannelSidebar
	title={data.guild.name}
	subtitle={data.guild.joinedAt ? `Golem joined ${data.guild.joinedAt}` : 'Golem is not here yet'}
	groupLabel="Settings"
	{sections}
>
	{@render children()}
</ChannelSidebar>
