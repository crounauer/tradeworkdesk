FROM node:20-slim

# Install postgresql-client (provides pg_dump, pg_restore, psql)
RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@10.33.1

WORKDIR /app

# Copy workspace config (build context = monorepo root)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy only the packages the api-server needs
COPY artifacts/api-server/ ./artifacts/api-server/
COPY lib/ ./lib/
COPY scripts/ ./scripts/

# Install dependencies and build
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @workspace/api-server build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
