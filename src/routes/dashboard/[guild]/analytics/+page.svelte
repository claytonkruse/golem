<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Chart from '#lib/components/ui/chart/index.js';
	import { AreaChart, BarChart, LineChart } from 'layerchart';

	let { data } = $props();

	const days = $derived(data.analytics.days);
	const total = (key: 'joins' | 'leaves' | 'messages') =>
		days.reduce((sum, day) => sum + day[key], 0);
	const joins = $derived(total('joins'));
	const leaves = $derived(total('leaves'));
	const messages = $derived(total('messages'));
	const averageActive = $derived(
		Math.round(days.reduce((sum, day) => sum + day.activeMembers, 0) / days.length)
	);

	// The theme's chart shades, all one hue. Joins take the lighter shade and leaves the darker,
	// picked per mode so the two stay apart, color blindness included, on both cards.
	const joinColor = { light: 'var(--chart-2)', dark: 'var(--chart-1)' };
	const leaveColor = { light: 'var(--chart-5)', dark: 'var(--chart-3)' };
	const single = 'var(--chart-2)';
	const config = {
		joins: { label: 'Joins', theme: joinColor },
		leaves: { label: 'Leaves', theme: leaveColor },
		net: { label: 'Net growth', color: single },
		messages: { label: 'Messages', color: single },
		activeMembers: { label: 'Active members', color: single }
	} satisfies Chart.ChartConfig;

	// Days are stored as UTC dates, so they are labelled in UTC too.
	const dayLabel = (day: string) =>
		new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	// About six labels along the bottom, whatever the range.
	const tickDays = $derived(
		days.filter((_, index) => index % Math.ceil(days.length / 6) === 0).map((day) => day.day)
	);
	const xAxis = $derived({ ticks: tickDays, format: dayLabel });
	const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
	const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

	const stats = $derived([
		{ label: 'Joins', value: String(joins) },
		{ label: 'Leaves', value: String(leaves) },
		{ label: 'Net growth', value: signed(joins - leaves) },
		{ label: 'Messages', value: messages.toLocaleString() },
		{ label: 'Active members a day', value: String(averageActive), hint: 'on average' }
	]);
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Joins, leaves and messages in this server, by day in UTC. Apps, webhooks and system messages
		aren't counted.
		{#if data.analytics.trackedSince}
			Golem has recorded these since {dayLabel(data.analytics.trackedSince)}.
		{:else}
			Nothing has been recorded yet; charts fill in as members join, leave and chat.
		{/if}
	</p>
</div>

<nav class="flex gap-1" aria-label="Time range">
	{#each data.ranges as range (range)}
		<a
			href="{resolve(`dashboard/${page.params.guild}/analytics/`)}?days={range}"
			aria-current={range === data.days ? 'page' : undefined}
			class={[
				'rounded-md px-2.5 py-1 text-xs font-medium',
				range === data.days
					? 'bg-secondary text-secondary-foreground'
					: 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
			]}>Last {range} days</a
		>
	{/each}
</nav>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
	{#each stats as stat (stat.label)}
		<Card.Root size="sm">
			<Card.Content class="flex flex-col gap-0.5">
				<span class="text-xs text-muted-foreground">{stat.label}</span>
				<span class="text-2xl font-semibold tracking-tight">{stat.value}</span>
				{#if stat.hint}<span class="text-xs text-muted-foreground">{stat.hint}</span>{/if}
			</Card.Content>
		</Card.Root>
	{/each}
</div>

<div class="@container grid gap-4 xl:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>Joins and leaves</Card.Title>
			<Card.Description>Members who joined and left each day.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Chart.Container {config} class="aspect-auto h-56 w-full">
				<BarChart
					data={days}
					x="day"
					axis="x"
					seriesLayout="group"
					legend
					series={[
						{ key: 'joins', label: 'Joins', color: 'var(--color-joins)' },
						{ key: 'leaves', label: 'Leaves', color: 'var(--color-leaves)' }
					]}
					props={{ xAxis, bars: { stroke: 'none' } }}
				>
					{#snippet tooltip()}
						<Chart.Tooltip labelFormatter={dayLabel} indicator="line" />
					{/snippet}
				</BarChart>
			</Chart.Container>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Net growth</Card.Title>
			<Card.Description>Joins minus leaves, added up from the start of the range.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Chart.Container {config} class="aspect-auto h-56 w-full">
				<AreaChart
					data={days}
					x={(day) => new Date(`${day.day}T00:00:00Z`)}
					axis="x"
					series={[{ key: 'net', label: 'Net growth', color: 'var(--color-net)' }]}
					props={{
						xAxis: { format: (date: Date) => dayLabel(date.toISOString().slice(0, 10)) },
						area: { fillOpacity: 0.1, line: { strokeWidth: 2 } }
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip
							labelFormatter={(date: Date) => dayLabel(date.toISOString().slice(0, 10))}
							indicator="line"
						/>
					{/snippet}
				</AreaChart>
			</Chart.Container>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Messages</Card.Title>
			<Card.Description>Messages members sent each day.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Chart.Container {config} class="aspect-auto h-56 w-full">
				<BarChart
					data={days}
					x="day"
					axis="x"
					series={[{ key: 'messages', label: 'Messages', color: 'var(--color-messages)' }]}
					props={{ xAxis, bars: { stroke: 'none' } }}
				>
					{#snippet tooltip()}
						<Chart.Tooltip labelFormatter={dayLabel} indicator="line" />
					{/snippet}
				</BarChart>
			</Chart.Container>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Active members</Card.Title>
			<Card.Description>Members who sent at least one message each day.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Chart.Container {config} class="aspect-auto h-56 w-full">
				<LineChart
					data={days}
					x={(day) => new Date(`${day.day}T00:00:00Z`)}
					axis="x"
					series={[
						{ key: 'activeMembers', label: 'Active members', color: 'var(--color-activeMembers)' }
					]}
					props={{
						xAxis: { format: (date: Date) => dayLabel(date.toISOString().slice(0, 10)) },
						spline: { strokeWidth: 2 }
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip
							labelFormatter={(date: Date) => dayLabel(date.toISOString().slice(0, 10))}
							indicator="line"
						/>
					{/snippet}
				</LineChart>
			</Chart.Container>
		</Card.Content>
	</Card.Root>
</div>

<Card.Root>
	<Card.Header>
		<Card.Title>Retention</Card.Title>
		<Card.Description>
			Of the members who joined in this range, how many were still here after each period. Only
			joins at least that old count.
		</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-3 sm:grid-cols-3">
		{#each data.analytics.retention as row (row.days)}
			<div class="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2">
				<span class="text-xs text-muted-foreground">
					After {row.days}
					{row.days === 1 ? 'day' : 'days'}
				</span>
				{#if row.joins > 0}
					<span class="text-2xl font-semibold tracking-tight">{percent(row.stayed, row.joins)}</span
					>
					<span class="text-xs text-muted-foreground">{row.stayed} of {row.joins} stayed</span>
				{:else}
					<span class="text-sm text-muted-foreground">No joins old enough yet</span>
				{/if}
			</div>
		{/each}
	</Card.Content>
</Card.Root>

{#snippet personRow(who: { name: string; username: string | null; avatar: string })}
	<span class="flex min-w-0 items-center gap-2">
		<img src={who.avatar} alt="" class="size-6 shrink-0 rounded-full" />
		<span class="truncate text-sm font-medium">{who.name}</span>
		{#if who.username && who.username !== who.name}
			<span class="truncate text-xs text-muted-foreground">@{who.username}</span>
		{/if}
	</span>
{/snippet}

<div class="flex flex-col gap-1 pt-2">
	<h2 class="font-heading text-lg font-semibold tracking-tight">Invites</h2>
	<p class="text-sm/relaxed text-muted-foreground">All time, not affected by the range above.</p>
</div>

<div class="grid gap-4 xl:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>Top invites</Card.Title>
			<Card.Description>
				The {data.topInvites?.length === 1 ? 'link' : 'links'} used most, counting everyone who joined
				through them, including members who later left.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.topInvites === null}
				<p class="text-sm text-muted-foreground">
					Golem needs the Manage Server permission to see this server's invite links.
				</p>
			{:else if data.topInvites.length === 0}
				<p class="text-sm text-muted-foreground">No invite link has been used yet.</p>
			{:else}
				<ol class="flex flex-col divide-y">
					{#each data.topInvites as invite (invite.code)}
						<li class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
							<span class="flex min-w-0 flex-col gap-1">
								<code class="text-xs text-foreground">discord.gg/{invite.code}</code>
								{#if invite.inviter}
									{@render personRow(invite.inviter)}
								{:else}
									<span class="text-xs text-muted-foreground">Made by Discord</span>
								{/if}
							</span>
							<span class="shrink-0 text-right">
								<span class="text-lg font-semibold tabular-nums">{invite.uses}</span>
								<span class="text-xs text-muted-foreground"
									>{invite.uses === 1 ? 'use' : 'uses'}</span
								>
							</span>
						</li>
					{/each}
				</ol>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Top inviters</Card.Title>
			<Card.Description>
				Members each inviter brought in who are still here, from when Golem started tracking
				invites, plus any added by hand. Also available in Discord with <code
					class="text-foreground">/topinviters</code
				>.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.topInviters.length === 0}
				<p class="text-sm text-muted-foreground">
					No invites are tracked yet. Golem tracks them while "Show who invited the member" is on in
					the logs or the welcome message uses an invite variable.
				</p>
			{:else}
				<ol class="flex flex-col divide-y">
					{#each data.topInviters as inviter (inviter.id)}
						<li class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
							<span class="flex min-w-0 items-center gap-3">
								<span class="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums"
									>{inviter.rank}</span
								>
								{@render personRow(inviter)}
							</span>
							<span class="shrink-0 text-right">
								<span class="text-lg font-semibold tabular-nums">{inviter.invites}</span>
								<span class="text-xs text-muted-foreground"
									>{inviter.invites === 1 ? 'member' : 'members'}</span
								>
							</span>
						</li>
					{/each}
				</ol>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
