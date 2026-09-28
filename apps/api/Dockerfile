# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ---------------------------------------------------------------------------
# 1. Prune the monorepo down to just what @durgapandals/api needs
# ---------------------------------------------------------------------------
FROM base AS pruner
WORKDIR /app
RUN pnpm add -g turbo@^2.1.0
COPY . .
RUN turbo prune @durgapandals/api --docker

# ---------------------------------------------------------------------------
# 2. Install dependencies using only the pruned manifests (cacheable layer),
#    then lay the pruned source on top
# ---------------------------------------------------------------------------
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# ---------------------------------------------------------------------------
# 3. Runtime image
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 fastify
COPY --from=installer --chown=fastify:nodejs /app .
USER fastify

ENV NODE_ENV=production
EXPOSE 4000

CMD ["apps/api/node_modules/.bin/tsx", "apps/api/src/server.ts"]
