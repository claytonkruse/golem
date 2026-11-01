<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import appleTouchIcon from '#lib/assets/apple-touch-icon.png';
	import favicon from '#lib/assets/favicon.png';
	import golem from '#lib/assets/golem.jpg';
	import { ModeWatcher } from 'mode-watcher';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const description =
		'Golem is a Discord bot that answers slash commands with private replies and never pings your server.';
	// Link previews need an absolute URL. adapter-node builds the origin from the Host
	// header and assumes https, so a reverse proxy must pass Host through (see README).
	const image = $derived(new URL(golem, page.url.origin).href);
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
	<link rel="apple-touch-icon" href={appleTouchIcon} />
	<title>Golem</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Golem" />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<ModeWatcher />
{@render children()}
