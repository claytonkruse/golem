<img src="src/lib/assets/golem.jpg" alt="Golem" width="96" height="96" align="right" />

# Golem

General-purpose Discord bot. [Discord.js](https://discord.js.org/) runs the gateway client. [SvelteKit](https://svelte.dev/docs/kit) and [shadcn-svelte](https://www.shadcn-svelte.com/) (preset `b2w2enLDFC`) are the dashboard.

The bot only asks for the `Guilds` intent, which is enough for slash commands.

## Setup

Requires Node.js 24 or newer and pnpm.

1. In the [Discord developer portal](https://discord.com/developers/applications), open the Golem application and add a bot user.
2. Under **Bot**, turn on **Public Bot** so anyone can add Golem, and leave **Requires OAuth2 Code Grant** off.
3. Copy `.env.example` to `.env` and set `DISCORD_BOT_TOKEN`. Set `DISCORD_GUILD_ID` to a test server while developing so command registration is instant.
4. Install dependencies, register commands, and start the bot:

```sh
pnpm install
pnpm db:migrate
pnpm bot:deploy
pnpm bot
```

`pnpm db:migrate` creates `data/golem.db`. The bot also applies pending migrations every time it starts, so in production you only need it if the dashboard starts first.

The bot prints its invite link on startup, and the dashboard has an **Add to Discord** button with the same link.

## Configuration

`config.yaml` is committed and holds public settings: the application ID, the public key, and the permissions the invite link asks for. The comments in that file explain each one.

`.env` holds the bot token and the OAuth client secret and is never committed. It can also set `DISCORD_CLIENT_ID` to run against a separate development application and `DISCORD_GUILD_ID` for a test server.

## Database

Golem uses SQLite through [Drizzle ORM](https://orm.drizzle.team/) and `better-sqlite3`. The bot, the dashboard and the scripts all open the same file, `data/golem.db` by default or `DATABASE_PATH` when it is set. WAL mode lets them read and write at the same time, which is why the dashboard runs on the same host with `adapter-node`.

- `bot/src/db/schema.ts` defines the tables. Store Discord ids as `text`, since they don't fit in a JavaScript number.
- Put queries in modules next to it, like `bot/src/db/guilds.ts`, and import those from commands and the dashboard rather than writing queries inline. That keeps a later move to Postgres in one place.
- After you change the schema, run `pnpm db:generate --name <change>` and commit the new file in `bot/drizzle`.
- Only the bot and `pnpm db:migrate` apply migrations. Drizzle's migrator isn't safe to run from two processes at once.
- Back up the database with Litestream or `sqlite3 data/golem.db ".backup backup.db"`. Copying the file while the bot runs can miss writes still in the `-wal` file.

## Dashboard

People sign in with Discord at `/dashboard/` and see the servers they own or have Manage Server in. Servers with Golem link to a page for that server's settings; the others get an invite link with that server preselected.

Setup, in the developer portal under **OAuth2**:

1. Copy the **Client Secret** into `.env` as `DISCORD_CLIENT_SECRET`.
2. Add a redirect for every origin the dashboard runs on. The trailing slash is required, because every route ends in one (`trailingSlash = 'always'`) and Discord matches redirects exactly:
   - `http://localhost:5173/auth/callback/` for `pnpm dev`
   - `https://your-domain/auth/callback/` in production

How it works:

- Sign-in asks only for `identify` and `guilds`. The session cookie is `httpOnly`, and the database stores a SHA-256 hash of it, never the cookie itself.
- Sessions last as long as Discord's token (7 days). If someone revokes Golem in Discord's settings, their next dashboard visit ends the session and starts a fresh sign-in.
- Each dashboard load checks access itself with `managedGuilds`/`managedGuild` in `src/lib/server/guilds.ts`. A server the person cannot manage is a 404.
- Each person's server list is cached for a minute, because Discord rate limits that endpoint.
- `+server.ts` endpoints do not inherit `trailingSlash` from the layout, so each one exports it.

### Running it in production

```sh
pnpm build
node --env-file=.env build
```

adapter-node builds the site's origin from the `Host` header and assumes `https`. That origin is used for the OAuth redirect, link previews and SvelteKit's CSRF check, so the reverse proxy in front of it must pass `Host` through. If it sends the original host in another header instead, set `HOST_HEADER=x-forwarded-host` (and `PROTOCOL_HEADER=x-forwarded-proto` if it isn't HTTPS-only). Running `node build` over plain HTTP makes sign-out fail with "Cross-site POST form submissions are forbidden", since the browser's `http://` origin won't match.

## Running as a public bot

- Commands are server installs (`setIntegrationTypes(GuildInstall)`) and work in servers and in DMs with Golem (`setContexts`). Set both on every new command.
- `pnpm bot:deploy:global` publishes commands to every server and clears the test server's copies so they don't show up twice. Global changes can take up to an hour to appear.
- The client uses `shards: 'auto'`, so it stays under Discord's 2,500 servers per shard limit without code changes. Past a few thousand servers, move to discord.js's `ShardingManager` so shards run in separate processes.
- Replies never ping anyone by default (`allowedMentions: { parse: [] }`). A command that should ping must opt in on that reply.
- Replies from `/help` and `/ping` are ephemeral, so they don't clutter other people's channels.

The dashboard:

```sh
pnpm dev
```

## Scripts

| Script                   | What it does                            |
| ------------------------ | --------------------------------------- |
| `pnpm dev`               | SvelteKit dashboard                     |
| `pnpm bot`               | Log in and listen for slash commands    |
| `pnpm bot:deploy`        | Publish slash commands to Discord       |
| `pnpm bot:deploy:global` | Publish globally, clear the test server |
| `pnpm db:generate`       | Create a migration from schema changes  |
| `pnpm db:migrate`        | Apply pending migrations                |
| `pnpm check`             | Typecheck the dashboard and the bot     |
| `pnpm lint`              | Prettier and ESLint                     |

## Adding a command

Add a module in `bot/src/commands` that exports `command` with `data` (a `SlashCommandBuilder`) and `execute`. `bot/src/commands/ping.ts` is the pattern. Register it again with `pnpm bot:deploy`. `/help` and the dashboard list it automatically. Command modules must not import `bot/src/config.ts`, because the dashboard loads them too and has no token.

Events live in `bot/src/events` and export `event` with `name` and `execute`.
