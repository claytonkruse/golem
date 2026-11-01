<script lang="ts">
	import { resolve } from '$app/paths';
	import golem from '#lib/assets/golem.jpg';
	import SiteHeader from '#lib/components/site-header.svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import ArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import BellOff from '@tabler/icons-svelte/icons/bell-off';
	import BrandDiscord from '@tabler/icons-svelte/icons/brand-discord';
	import LayoutDashboard from '@tabler/icons-svelte/icons/layout-dashboard';
	import Lock from '@tabler/icons-svelte/icons/lock';
	import ShieldCheck from '@tabler/icons-svelte/icons/shield-check';
	import Slash from '@tabler/icons-svelte/icons/slash';

	let { data } = $props();

	const features = $derived([
		{
			icon: Slash,
			title: 'Slash commands',
			body: 'Type / in any channel to see everything Golem can do. There are no prefixes to remember.'
		},
		{
			icon: Lock,
			title: 'Private replies',
			body: 'Answers to /help and /ping only show up for you, so they never clutter a channel.'
		},
		{
			icon: BellOff,
			title: 'No surprise pings',
			body: 'Golem cannot mention @everyone, roles or members unless a command is built to.'
		},
		data.asksForPermissions
			? {
					icon: ShieldCheck,
					title: 'Only what it needs',
					body: 'The invite asks for the permissions its commands use and nothing more.'
				}
			: {
					icon: ShieldCheck,
					title: 'No permissions needed',
					body: 'The invite asks for no server permissions. Slash commands work without them.'
				}
	]);

	const serverText = $derived(
		`In ${data.servers.toLocaleString('en-US')} ${data.servers === 1 ? 'server' : 'servers'}`
	);
</script>

{#snippet addButton(className: string)}
	<Button href={data.invite} target="_blank" rel="noreferrer" class={className}>
		<BrandDiscord data-icon="inline-start" />
		Add to Discord
	</Button>
{/snippet}

<div class="flex min-h-screen flex-col overflow-x-clip">
	<SiteHeader>
		{#snippet nav()}
			<Button href="#features" variant="ghost" class="hidden sm:inline-flex">Features</Button>
			<Button href="#commands" variant="ghost" class="hidden sm:inline-flex">Commands</Button>
		{/snippet}
		{#snippet actions()}
			<Button href={resolve('dashboard/')} variant="outline">
				{#if data.user}
					<img src={data.user.avatarUrl} alt="" class="size-4 rounded-full" />
				{:else}
					<LayoutDashboard data-icon="inline-start" />
				{/if}
				Dashboard
			</Button>
			{@render addButton('ml-1 hidden sm:inline-flex')}
		{/snippet}
	</SiteHeader>

	<main class="flex-1">
		<!-- isolate keeps the glow behind the hero; -top-14 reaches up under the see-through header. -->
		<div class="relative isolate">
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 -top-14 bottom-0 -z-10 bg-radial-[ellipse_at_top] from-primary/20 via-primary/5 to-transparent dark:from-primary/30"
			></div>
			<section
				class="mx-auto grid w-full max-w-5xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-24"
			>
				<div class="flex flex-col items-start gap-6">
					{#if data.servers > 0}
						<Badge variant="outline" class="bg-background/60">
							<span class="size-1.5 rounded-full bg-emerald-500"></span>
							{serverText}
						</Badge>
					{/if}
					<h1
						class="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl/tight"
					>
						A bot that doesn't need to be paid.
					</h1>
					<p class="max-w-md text-base/relaxed text-pretty text-muted-foreground">
						Golems don't require a salary. Golem does everything without a subscription. Its replies
						stay private, and it never pings anyone by accident.
					</p>
					<div class="flex flex-wrap items-center gap-2">
						{@render addButton('h-10 gap-2 px-4 text-sm')}
						<Button href="#commands" variant="outline" class="h-10 gap-2 px-4 text-sm">
							See commands
							<ArrowRight data-icon="inline-end" />
						</Button>
					</div>
				</div>

				<!-- An illustration of a command and its reply, not a live preview. -->
				<Card.Root class="shadow-xl ring-1 shadow-primary/5 ring-border" aria-hidden="true">
					<Card.Content class="flex flex-col gap-4 text-sm">
						<div class="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs">
							<span class="text-primary-text">/ping</span>
							<span class="text-muted-foreground">Check whether Golem is responding.</span>
						</div>
						<div class="flex gap-3">
							<img src={golem} alt="" width="36" height="36" class="size-9 shrink-0 rounded-full" />
							<div class="flex flex-col gap-1">
								<div class="flex items-center gap-2">
									<span class="font-medium">Golem</span>
									<Badge variant="secondary" class="h-4 px-1 text-[0.625rem]">APP</Badge>
								</div>
								<p>Pong. Round trip 84ms. Gateway 41ms.</p>
								<p class="flex items-center gap-1 text-xs text-muted-foreground">
									<Lock class="size-3" />
									Only you can see this
								</p>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</section>
		</div>

		<section id="features" class="scroll-mt-16 border-t bg-muted/30">
			<div class="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
				<div class="flex max-w-xl flex-col gap-2">
					<h2 class="font-heading text-2xl font-semibold tracking-tight">Polite in every server</h2>
					<p class="text-sm/relaxed text-muted-foreground">
						Golem is built to be added by anyone without making a mess of the place.
					</p>
				</div>
				<div class="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each features as feature (feature.title)}
						<Card.Root>
							<Card.Header>
								<span
									class="mb-2 flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary-text"
								>
									<feature.icon class="size-4" />
								</span>
								<Card.Title>{feature.title}</Card.Title>
								<Card.Description class="text-xs/relaxed">{feature.body}</Card.Description>
							</Card.Header>
						</Card.Root>
					{/each}
				</div>
			</div>
		</section>

		<section id="commands" class="scroll-mt-16 border-t">
			<div class="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
				<div class="flex max-w-xl flex-col gap-2">
					<h2 class="font-heading text-2xl font-semibold tracking-tight">Commands</h2>
					<p class="text-sm/relaxed text-muted-foreground">
						Everything Golem can do today. Run /help in Discord for the same list.
					</p>
				</div>
				<ul class="mt-10 grid gap-3 sm:grid-cols-2">
					{#each data.commands as command (command.name)}
						<li class="flex flex-col gap-1.5 rounded-lg border bg-card p-4">
							<code class="font-mono text-sm font-medium text-primary-text">/{command.name}</code>
							<p class="text-xs/relaxed text-muted-foreground">{command.description}</p>
						</li>
					{/each}
				</ul>
			</div>
		</section>

		<section class="border-t">
			<div
				class="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6"
			>
				<div class="flex flex-col gap-1">
					<h2 class="font-heading text-xl font-semibold tracking-tight">
						Add Golem to your server
					</h2>
					<p class="text-sm text-muted-foreground">
						It takes one click, and you can remove it just as easily.
					</p>
				</div>
				{@render addButton('h-10 gap-2 px-4 text-sm')}
			</div>
		</section>
	</main>

	<footer class="border-t">
		<div
			class="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6"
		>
			<span>Golem</span>
			<span>Not affiliated with Discord.</span>
		</div>
	</footer>
</div>
