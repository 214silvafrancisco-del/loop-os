# LOOP OS — imagem de produção (Next.js standalone)
# Build: docker build -t loop-os .   Run: docker run -p 3000:3000 --env-file .env.production loop-os

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
WORKDIR /app

# ── Dependências ──────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# As variáveis NEXT_PUBLIC_* entram no bundle do browser em build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Migrações aplicam-se fora da imagem (pnpm db:migrate a partir do Coolify ou do PC).
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
