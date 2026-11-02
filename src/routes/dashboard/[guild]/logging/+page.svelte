<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LogSettings from '#lib/components/log-settings.svelte';

	let { data, form } = $props();
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">Logging</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Pick the channels each event is posted to. <code class="text-foreground">/loghere</code> and
		<code class="text-foreground">/logstop</code> in Discord change the same settings.
	</p>
</div>
{#if form?.message}
	<p class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
		{form.message}
	</p>
{/if}
<LogSettings
	logging={data.logging}
	welcomeHref={resolve(`dashboard/${page.params.guild}/welcome/`)}
/>
