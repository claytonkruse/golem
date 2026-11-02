<script lang="ts">
	import { page } from '$app/state';
	import ModeToggle from '#lib/components/mode-toggle.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import Logout from '@tabler/icons-svelte/icons/logout';

	// The signed-in person at the bottom of the second column, like Discord's user area.
	const user = $derived(page.data.user as { name: string; avatarUrl: string } | null);
</script>

{#if user}
	<div class="flex items-center gap-2">
		<img src={user.avatarUrl} alt="" class="size-8 shrink-0 rounded-full" />
		<span class="min-w-0 flex-1 truncate text-sm font-medium">{user.name}</span>
		<ModeToggle />
		<form method="POST" action="/auth/logout/">
			<Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
				<Logout />
			</Button>
		</form>
	</div>
{/if}
