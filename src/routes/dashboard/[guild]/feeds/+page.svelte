<script lang="ts">
	import FeedSettings from '#lib/components/feed-settings.svelte';

	let { data, form } = $props();
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">Feeds</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Post new articles, videos and streams in a channel. <code class="text-foreground">/feed</code>
		in this server changes the same list. For feeds in your own DMs, use Your feeds.
	</p>
</div>
<FeedSettings feeds={data.feeds} {form} />
