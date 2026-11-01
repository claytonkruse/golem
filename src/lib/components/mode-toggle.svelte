<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { setMode, systemPrefersMode, userPrefersMode } from 'mode-watcher';
	import Moon from '@tabler/icons-svelte/icons/moon';
	import Sun from '@tabler/icons-svelte/icons/sun';

	// Two states: follow the system, or show the opposite of it. A saved choice that
	// happens to match the system counts as following it, so the next click always
	// changes what is on screen.
	const opposite = $derived(systemPrefersMode.current === 'dark' ? 'light' : 'dark');
	const following = $derived(
		userPrefersMode.current === 'system' || userPrefersMode.current === systemPrefersMode.current
	);
	const label = $derived(following ? `Switch to ${opposite} mode` : 'Match system theme');

	function toggle() {
		setMode(following ? opposite : 'system');
	}
</script>

<Button
	variant="ghost"
	size="icon"
	class="relative"
	onclick={toggle}
	aria-label={label}
	aria-pressed={!following}
	title={label}
>
	<!-- Swapped with the dark variant, not script, so the server render shows the right icon. -->
	<Sun class="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
	<Moon class="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
</Button>
