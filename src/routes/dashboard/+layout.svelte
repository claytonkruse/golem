<script lang="ts">
	import SiteHeader from '#lib/components/site-header.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import Logout from '@tabler/icons-svelte/icons/logout';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader>
		{#snippet actions()}
			{#if data.user}
				<span class="ml-1 hidden items-center gap-2 text-xs font-medium sm:flex">
					<img src={data.user.avatarUrl} alt="" class="size-6 rounded-full" />
					{data.user.name}
				</span>
				<form method="POST" action="/auth/logout/" class="ml-1">
					<Button type="submit" variant="ghost">
						<Logout data-icon="inline-start" />
						Sign out
					</Button>
				</form>
			{/if}
		{/snippet}
	</SiteHeader>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-20 sm:px-6">
		{@render children()}
	</main>
</div>
