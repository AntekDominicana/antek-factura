# ==========================================
# ANTEK Factura - Dockerfile Web (Next.js 15)
# Producción Multi-Stage Hardened Standalone
# ==========================================

FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat

# Copiar manifiestos
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/fiscal-engine/package.json ./packages/fiscal-engine/
COPY apps/web/package.json ./apps/web/

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY packages/database ./packages/database
COPY packages/fiscal-engine ./packages/fiscal-engine
COPY apps/web ./apps/web

# Generar Prisma y compilar librerías
RUN pnpm --filter @factura-ecf/database exec prisma generate
RUN pnpm --filter @factura-ecf/fiscal-engine run build

# Variables de entorno en tiempo de build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=1

# Compilar Next.js Standalone
RUN pnpm --filter @factura-ecf/web run build

# ==========================================
# Runner de Producción (Minimal & Secure)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar assets estáticos y standalone
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
