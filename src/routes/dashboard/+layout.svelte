<script lang="ts">
	import ServerRail from '#lib/components/dashboard/server-rail.svelte';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let { children } = $props();
</script>

<!-- Laid out like Discord's app: the server rail, then each page brings its own second
     column (see ChannelSidebar) and content. -->
<Tooltip.Provider>
	<div class="flex h-svh overflow-hidden bg-background">
		<div class="hidden md:flex">
			<ServerRail />
		</div>
		<div class="flex min-w-0 flex-1">
			{@render children()}
		</div>
	</div>
</Tooltip.Provider>
