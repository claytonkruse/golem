<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { renderWelcome } from '#bot/lib/welcome.ts';
	import { channelGroups } from '#lib/channel-groups.js';
	import { escapeDiscordMarkdown, renderDiscordMarkdown } from '#lib/discord-markdown.js';
	import SettingSwitch from '#lib/components/setting-switch.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import InfoCircle from '@tabler/icons-svelte/icons/info-circle';

	let { data, form } = $props();

	// Edited here and saved with the button; starts from what is saved.
	let message = $derived(data.welcome.message);
	let saving = $state(false);

	const categories = $derived(channelGroups(data.welcome.channels));
	const channelSaved = $derived(
		data.welcome.channelId !== null &&
			data.welcome.channels.some((channel) => channel.id === data.welcome.channelId)
	);
	// Sample values, with mentions written as the bot sends them so they show as Discord does.
	const preview = $derived(
		renderDiscordMarkdown(
			renderWelcome(message, {
				user: '<@member>',
				username: 'newmember',
				server: escapeDiscordMarkdown(page.data.guild.name),
				membercount: '128',
				inviter: '<@inviter>',
				invitername: 'inviter',
				invitecount: '5',
				leavecount: '1'
			}),
			{
				users: { member: 'NewMember', inviter: 'Inviter' },
				channels: Object.fromEntries(
					data.welcome.channels.map((channel) => [channel.id, channel.name])
				)
			}
		)
	);

	// Spoilers stay hidden until clicked, like in Discord.
	function revealSpoiler(event: MouseEvent) {
		const spoiler = (event.target as HTMLElement).closest('.spoiler');
		spoiler?.classList.add('revealed');
	}

	const fieldClass =
		'w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30';
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">Welcome</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Post a message when someone joins. <code class="text-foreground">/welcome</code> in Discord changes
		the same settings.
	</p>
</div>
<p
	class="flex items-start gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs/relaxed text-secondary-foreground"
>
	<InfoCircle class="mt-0.5 size-3.5 shrink-0" />
	<span>
		This greets new members publicly. To record who invited someone and how many times they left
		before for your moderators, also see <strong>Member joined</strong> on the
		<a href={resolve(`dashboard/${page.params.guild}/logging/`)} class="underline">Logging</a> page.
	</span>
</p>
{#if form?.message}
	<p class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
		{form.message}
	</p>
{:else if form?.saved}
	<p class="rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground" role="status">
		Saved.
	</p>
{/if}

<Card.Root>
	<Card.Content class="flex flex-col gap-4">
		<SettingSwitch
			action="?/enabled"
			id="welcome-enabled"
			checked={data.welcome.enabled}
			disabled={!channelSaved && !data.welcome.enabled}
			label="Welcome new members"
			description={channelSaved
				? 'Posts the message below whenever someone joins. Apps added to the server are not welcomed.'
				: 'Pick a channel and save the message first.'}
		/>
		<SettingSwitch
			action="?/pings"
			id="welcome-pings"
			checked={data.welcome.pingMentions}
			label="Ping mentioned members"
			description={'Members mentioned in the message, like {user} and {inviter}, get a notification. Off, the mentions still show but nobody is pinged. Roles, @everyone and @here never ping.'}
		/>
		<form
			method="POST"
			action="?/save"
			class="flex flex-col gap-3 border-t pt-4"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					// Keep what was typed if the save fails.
					await update({ reset: false });
					saving = false;
				};
			}}
		>
			<label class="flex max-w-sm flex-col gap-1.5 text-xs font-medium">
				Post in
				<select
					name="channel"
					required
					class={[fieldClass, 'h-7']}
					value={channelSaved ? data.welcome.channelId : ''}
				>
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
			<label class="flex flex-col gap-1.5 text-xs font-medium">
				Message
				<textarea
					name="message"
					required
					rows="4"
					maxlength={data.welcome.maxLength}
					bind:value={message}
					class={[fieldClass, 'resize-y py-1.5 font-mono']}></textarea>
			</label>
			<div class="flex flex-col gap-1.5 text-xs">
				<span class="font-medium">Preview</span>
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					class="discord-preview rounded-md bg-muted px-3 py-2 text-sm/relaxed break-words text-foreground"
					onclick={revealSpoiler}
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderDiscordMarkdown escapes all text. -->
					{@html preview}
				</div>
			</div>
			<div>
				<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>

<Card.Root>
	<Card.Header>
		<Card.Title>Variables</Card.Title>
		<Card.Description>
			Type these in the message, braces included. {'{inviter}'}, {'{invitername}'} and {'{invitecount}'}
			need Golem to have the Manage Server permission, since Discord only shows invites to members who
			have it.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<dl class="grid gap-x-4 gap-y-2 text-xs/relaxed sm:grid-cols-[auto_1fr]">
			{#each data.welcome.variables as variable (variable.key)}
				<dt><code class="text-foreground">{`{${variable.key}}`}</code></dt>
				<dd class="text-muted-foreground">{variable.description}</dd>
			{/each}
		</dl>
	</Card.Content>
</Card.Root>

<style>
	.discord-preview :global {
		h1,
		h2,
		h3 {
			margin: 0.25rem 0;
			font-weight: 700;
			line-height: 1.375;
		}
		h1 {
			font-size: 1.5rem;
		}
		h2 {
			font-size: 1.25rem;
		}
		h3 {
			font-size: 1rem;
		}
		small {
			display: block;
			font-size: 0.75rem;
			color: var(--muted-foreground);
		}
		blockquote {
			border-left: 4px solid var(--border);
			padding-left: 0.75rem;
		}
		ul,
		ol {
			padding-left: 1.25rem;
		}
		ul {
			list-style: disc;
		}
		ol {
			list-style: decimal;
		}
		code {
			border-radius: 0.25rem;
			background: var(--background);
			padding: 0 0.25rem;
			font-family: var(--font-mono);
			font-size: 0.85em;
		}
		pre {
			margin: 0.25rem 0;
			overflow-x: auto;
			border: 1px solid var(--border);
			border-radius: 0.25rem;
			background: var(--background);
			padding: 0.5rem;
			white-space: pre-wrap;
		}
		pre code {
			padding: 0;
		}
		a {
			color: oklch(0.6 0.15 250);
		}
		a:hover {
			text-decoration: underline;
		}
		.mention,
		.timestamp {
			border-radius: 0.25rem;
			background: oklch(0.6 0.15 270 / 0.2);
			padding: 0 0.125rem;
			color: oklch(0.55 0.17 270);
			font-weight: 500;
		}
		.timestamp {
			background: var(--background);
			color: inherit;
		}
		.spoiler {
			cursor: pointer;
			border-radius: 0.25rem;
			background: var(--foreground);
			color: transparent;
		}
		.spoiler :is(*) {
			visibility: hidden;
		}
		.spoiler.revealed {
			cursor: auto;
			background: var(--background);
			color: inherit;
		}
		.spoiler.revealed :is(*) {
			visibility: visible;
		}
	}
</style>
