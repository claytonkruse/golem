<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { tick } from 'svelte';

	// A labelled switch that saves itself through a form action. The action reads
	// `enabled`, which the switch only sends while it is on, plus any hidden `fields`.
	type Props = {
		action: string;
		id: string;
		checked: boolean;
		label: string;
		description?: string;
		disabled?: boolean;
		fields?: Record<string, string>;
	};

	let { action, id, checked, label, description, disabled = false, fields = {} }: Props = $props();
	let form = $state<HTMLFormElement>();
</script>

<form method="POST" {action} use:enhance bind:this={form} class="flex items-start gap-3">
	{#each Object.entries(fields) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
	<Switch
		{id}
		name="enabled"
		class="mt-0.5"
		{checked}
		{disabled}
		onCheckedChange={async () => {
			// Wait for the switch's hidden input to match its new state before sending.
			await tick();
			form?.requestSubmit();
		}}
	/>
	<label for={id} class={['flex flex-col gap-0.5', disabled && 'opacity-50']}>
		<span class="text-sm font-medium">{label}</span>
		{#if description}
			<span class="text-xs/relaxed text-muted-foreground">{description}</span>
		{/if}
	</label>
	<noscript>
		<Button type="submit" size="xs" variant="outline">Save</Button>
	</noscript>
</form>
