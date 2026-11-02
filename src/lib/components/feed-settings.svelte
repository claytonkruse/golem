<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Subscription } from '#bot/db/feeds.ts';
	import { channelGroups } from '#lib/channel-groups.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { ChannelOption } from '#lib/server/logging.js';
	import AlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import BrandKick from '@tabler/icons-svelte/icons/brand-kick';
	import BrandTwitch from '@tabler/icons-svelte/icons/brand-twitch';
	import BrandYoutube from '@tabler/icons-svelte/icons/brand-youtube';
	import Rss from '@tabler/icons-svelte/icons/rss';
	import X from '@tabler/icons-svelte/icons/x';

	// The add form and the list, for a server's channels or, without channels, the signed-in
	// person's DMs.
	type Feeds = {
		kinds: {
			kind: string;
			label: string;
			input: string;
			placeholder: string;
			help: string;
			available: boolean;
			needs: string | null;
		}[];
		channels?: ChannelOption[];
		list: Subscription[];
		limit: number;
	};
	type Form = {
		message?: string;
		added?: string;
		source?: string;
		channel?: string;
	} | null;

	let { feeds, form }: { feeds: Feeds; form: Form } = $props();

	const icons = { rss: Rss, youtube: BrandYoutube, twitch: BrandTwitch, kick: BrandKick };

	let kind = $state('rss');
	let adding = $state(false);

	const selected = $derived(feeds.kinds.find((entry) => entry.kind === kind) ?? feeds.kinds[0]);
	const kindLabels = $derived(new Map(feeds.kinds.map((entry) => [entry.kind, entry.label])));
	const channelNames = $derived(
		new Map((feeds.channels ?? []).map((channel) => [channel.id, channel.name]))
	);
	const categories = $derived(channelGroups(feeds.channels ?? []));
	const full = $derived(feeds.list.length >= feeds.limit);

	const selectClass =
		'h-7 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30';
</script>

{#if form?.message}
	<p class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
		{form.message}
	</p>
{:else if form?.added}
	<p class="rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground" role="status">
		Now following {form.added}.
	</p>
{/if}

<Card.Root>
	<Card.Header>
		<Card.Title>Follow something</Card.Title>
		<Card.Description>{selected.help}</Card.Description>
	</Card.Header>
	<Card.Content class="@container flex flex-col gap-3">
		<form
			method="POST"
			action="?/add"
			class={[
				'grid items-end gap-3',
				feeds.channels
					? '@2xl:grid-cols-[9rem_minmax(0,1fr)_12rem_auto]'
					: '@xl:grid-cols-[9rem_minmax(0,1fr)_auto]'
			]}
			use:enhance={() => {
				adding = true;
				return async ({ update }) => {
					await update();
					adding = false;
				};
			}}
		>
			<label class="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
				Type
				<select name="kind" bind:value={kind} class={selectClass}>
					{#each feeds.kinds as entry (entry.kind)}
						<option value={entry.kind}>
							{entry.label}{entry.available ? '' : ' (not set up)'}
						</option>
					{/each}
				</select>
			</label>
			<label class="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
				{selected.input}
				<Input
					name="source"
					required
					autocomplete="off"
					spellcheck={false}
					placeholder={selected.placeholder}
					value={form?.source ?? ''}
				/>
			</label>
			{#if feeds.channels}
				<label class="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
					Post in
					<select name="channel" required class={selectClass} value={form?.channel ?? ''}>
						<option value="" disabled>Pick a channel</option>
						{#each categories as category (category.name + category.channels[0].id)}
							<optgroup label={category.name}>
								{#each category.channels as channel (channel.id)}
									<option value={channel.id}>#{channel.name}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>
			{/if}
			<Button type="submit" disabled={adding || !selected.available || full}>
				{adding ? 'Looking it up…' : 'Add'}
			</Button>
		</form>
		{#if !selected.available}
			<p class="flex items-start gap-1.5 text-xs/relaxed text-muted-foreground">
				<AlertTriangle class="mt-0.5 size-3.5 shrink-0 text-warning" />
				<span>
					{selected.label} feeds need <code class="text-foreground">{selected.needs}</code> in
					Golem's
					<code class="text-foreground">.env</code>.
				</span>
			</p>
		{:else if full}
			<p class="text-xs/relaxed text-muted-foreground">
				{feeds.channels ? 'This server follows' : 'You follow'}
				{feeds.limit} feeds, the most Golem allows. Remove one to add another.
			</p>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root>
	<Card.Header>
		<Card.Title>Following</Card.Title>
		<Card.Description>{feeds.list.length} of {feeds.limit}</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col divide-y">
		{#each feeds.list as feed (feed.id)}
			{@const Icon = icons[feed.kind]}
			{@const channel = channelNames.get(feed.channelId) ?? 'deleted-channel'}
			<div class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
				<Icon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- the feed's own site -->
					<a
						href={feed.url}
						target="_blank"
						rel="noopener noreferrer"
						class="truncate text-sm font-medium hover:underline"
					>
						{feed.title}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<span class="text-xs text-muted-foreground">
						{kindLabels.get(feed.kind)}{feeds.channels ? ` · #${channel}` : ''}
					</span>
					{#if feed.error}
						<span class="flex items-start gap-1 text-xs/relaxed text-destructive">
							<AlertTriangle class="mt-0.5 size-3 shrink-0" />
							{feed.error}
						</span>
					{/if}
				</div>
				<form method="POST" action="?/remove" use:enhance>
					<input type="hidden" name="id" value={feed.id} />
					<Button
						type="submit"
						variant="ghost"
						size="icon-sm"
						aria-label="Stop following {feed.title}"
						title="Stop following"
					>
						<X />
					</Button>
				</form>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				{feeds.channels
					? 'Nothing yet. Add a feed above and new posts will show up in the channel you pick.'
					: 'Nothing yet. Add a feed above and Golem will DM you new posts.'}
			</p>
		{/each}
	</Card.Content>
</Card.Root>
