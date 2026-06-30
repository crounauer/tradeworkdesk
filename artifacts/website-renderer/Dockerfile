FROM node:20-slim

RUN npm install -g pnpm@10.33.1

WORKDIR /app

# Copy the monorepo files needed to build the renderer.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY artifacts/website-renderer/ ./artifacts/website-renderer/

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @workspace/website-renderer build

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

EXPOSE 8080
CMD ["pnpm", "--filter", "@workspace/website-renderer", "start"]