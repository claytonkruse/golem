<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import AlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import InfoCircle from '@tabler/icons-svelte/icons/info-circle';
	import X from '@tabler/icons-svelte/icons/x';
	import type { LogOption } from '#bot/lib/log-events.ts';
	import { channelGroups } from '#lib/channel-groups.js';
	import type { ChannelOption } from '#lib/server/logging.js';

	type Logging = {
		groups: readonly { id: string; label: string }[];
		events: readonly { key: string; group: string; label: string; description: string }[];
		channels: ChannelOption[];
		settings: Record<string, string[]>;
		options: Partial<Record<string, LogOption[]>>;
		enabledOptions: string[];
	};

	// welcomeHref: the Welcome page, pointed to from Member joined since both show who invited
	// someone and how often they left before.
	let { logging, welcomeHref }: { logging: Logging; welcomeHref: string } = $props();

	const enabled = $derived(new Set(logging.enabledOptions));

	const channelNames = $derived(
		new Map(logging.channels.map((channel) => [channel.id, channel.name]))
	);

	const COLUMNS = [['members', 'moderation', 'messages'], ['server']];
	const columns = $derived(
		COLUMNS.map((ids) => ids.flatMap((id) => logging.groups.filter((group) => group.id === id)))
	);

	const categories = $derived(channelGroups(logging.channels));
</script>

{#snippet groupCard(group: Logging['groups'][number])}
	<Card.Root>
		<Card.Header>
			<Card.Title>{group.label}</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col divide-y">
			{#each logging.events.filter((event) => event.group === group.id) as event (event.key)}
				{@const selected = logging.settings[event.key] ?? []}
				<div class="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
						<div class="flex min-w-0 flex-col gap-0.5">
							<span class="text-sm font-medium">{event.label}</span>
							<span class="text-xs/relaxed text-muted-foreground">{event.description}</span>
						</div>
						<div class="flex flex-wrap items-center gap-1.5 sm:max-w-[55%] sm:justify-end">
							{#each selected as channelId (channelId)}
								{@const name = channelNames.get(channelId) ?? 'deleted-channel'}
								<form method="POST" action="?/remove" use:enhance class="contents">
									<input type="hidden" name="event" value={event.key} />
									<input type="hidden" name="channel" value={channelId} />
									<span
										class="inline-flex h-6 items-center gap-0.5 rounded-md bg-secondary pr-0.5 pl-2 text-xs text-secondary-foreground"
									>
										#{name}
										<button
											type="submit"
											class="rounded-sm p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
											aria-label="Stop logging {event.label} in #{name}"
											title="Stop logging here"
										>
											<X class="size-3" />
										</button>
									</span>
								</form>
							{/each}
							<form method="POST" action="?/add" use:enhance>
								<input type="hidden" name="event" value={event.key} />
								<select
									name="channel"
									aria-label="Log {event.label} in another channel"
									class="h-6 max-w-44 rounded-md border border-input bg-transparent px-1.5 text-xs text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
									onchange={(change) => change.currentTarget.form?.requestSubmit()}
								>
									<option value="">Add channel…</option>
									{#each categories as category (category.name + category.channels[0].id)}
										{@const available = category.channels.filter(
											(channel) => !selected.includes(channel.id)
										)}
										{#if available.length > 0}
											<optgroup label={category.name}>
												{#each available as channel (channel.id)}
													<option value={channel.id}>#{channel.name}</option>
												{/each}
											</optgroup>
										{/if}
									{/each}
								</select>
								<noscript>
									<Button type="submit" size="xs" variant="outline">Add</Button>
								</noscript>
							</form>
						</div>
					</div>
					<!-- Below the row, across the whole card, so long switch labels don't squeeze in
				     beside the channel picker. -->
					{#if logging.options[event.key]}
						<div class="flex flex-col gap-2">
							{#each logging.options[event.key] ?? [] as option (option.key)}
								{@const id = `${event.key}-${option.key}`}
								{@const words = option.label.split(' ')}
								{@const requirement = option.note === 'requirement'}
								{@const blocked =
									option.requires !== undefined && !enabled.has(`${event.key}:${option.requires}`)}
								<form method="POST" action="?/option" use:enhance class="flex items-center gap-2">
									<input type="hidden" name="event" value={event.key} />
									<input type="hidden" name="option" value={option.key} />
									<Switch
										{id}
										name="enabled"
										size="sm"
										checked={enabled.has(`${event.key}:${option.key}`) && !blocked}
										disabled={blocked}
										onCheckedChange={async () => {
											// Wait for the switch's hidden input to match its new state before sending.
											await tick();
											document.getElementById(id)?.closest('form')?.requestSubmit();
										}}
									/>
									<!-- The last word and the icon can't be split across lines, so the icon never
								     wraps onto a line of its own. Both labels name the same switch. -->
									<span class={['min-w-0 text-xs font-medium', blocked && 'opacity-50']}>
										<label for={id}>{words.slice(0, -1).join(' ')}</label>
										<span class="whitespace-nowrap">
											<label for={id}>{words.at(-1)}</label>
											<Tooltip.Root>
												<Tooltip.Trigger
													class={[
														'inline-flex rounded-sm p-0.5 align-middle focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
														requirement
															? 'text-warning hover:text-warning/80'
															: 'text-muted-foreground hover:text-foreground'
													]}
													aria-label={requirement
														? `Requirement for “${option.label}”`
														: `About “${option.label}”`}
												>
													{#if requirement}
														<AlertTriangle class="size-3.5" />
													{:else}
														<InfoCircle class="size-3.5" />
													{/if}
												</Tooltip.Trigger>
												<Tooltip.Content class="max-w-64">{option.description}</Tooltip.Content>
											</Tooltip.Root>
										</span>
									</span>
									<noscript>
										<Button type="submit" size="xs" variant="outline">Save</Button>
									</noscript>
								</form>
							{/each}
						</div>
					{/if}
					{#if event.key === 'member_join'}
						<p class="flex items-start gap-1.5 text-xs/relaxed text-muted-foreground">
							<InfoCircle class="mt-0.5 size-3.5 shrink-0" />
							<span>
								This log is for moderators. To greet new members publicly with who invited them and
								how often they left before, also see the
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built with resolve() by the page -->
								<a href={welcomeHref} class="text-foreground underline">Welcome</a> page.
							</span>
						</p>
					{/if}
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
{/snippet}

<!-- Two columns when the area is wide enough, measured on the area itself because the
     dashboard sidebar takes part of the window: the busy, people-facing groups on the left and
     the server's structure on the right. One column keeps the same reading order. -->
<Tooltip.Provider>
	<div class="@container">
		<div class="grid items-start gap-4 @3xl:grid-cols-2">
			{#each columns as column, index (index)}
				<div class="flex flex-col gap-4">
					{#each column as group (group.id)}
						{@render groupCard(group)}
					{/each}
				</div>
			{/each}
		</div>
	</div>
</Tooltip.Provider>
