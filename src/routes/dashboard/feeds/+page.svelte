<script lang="ts">
	import ChannelSidebar from '#lib/components/dashboard/channel-sidebar.svelte';
	import { homeSections } from '#lib/components/dashboard/home-sections.js';
	import FeedSettings from '#lib/components/feed-settings.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Your feeds · Golem</title>
</svelte:head>

<ChannelSidebar title="Golem" subtitle="Dashboard" groupLabel="Dashboard" sections={homeSections()}>
	<div class="flex flex-col gap-1">
		<h1 class="font-heading text-2xl font-semibold tracking-tight">Your feeds</h1>
		<p class="text-sm/relaxed text-muted-foreground">
			Golem DMs you new articles, videos and streams from these. <code class="text-foreground"
				>/feed</code
			> in a DM with Golem changes the same list. Golem can only DM you while you share a server with
			it and allow direct messages from that server's members.
		</p>
	</div>
	<FeedSettings feeds={data.feeds} {form} />
</ChannelSidebar>
