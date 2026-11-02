# One image runs both processes; compose.yaml picks the command for each.

FROM node:24-slim AS build
# Compilers for better-sqlite3, in case no prebuilt binary matches this Node version.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.16.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/config.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/bot ./bot
# uid 1000, so files it writes to the ./data bind mount belong to the host's first user.
USER node
