# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @ai-logist/shared-types build && \
    pnpm --filter @ai-logist/api build

FROM node:22-alpine AS runtime
RUN apk add --no-cache wget
WORKDIR /app
# pnpm workspace: deps physically live in /app/node_modules/.pnpm/ and the
# workspace package's node_modules/ contains symlinks pointing into that store.
# Copy BOTH so symlinks (e.g. apps/api/node_modules/@fastify/sensible) resolve.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
