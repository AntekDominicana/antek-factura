# ==========================================
# ANTEK Factura - Dockerfile API (NestJS)
# Producción Multi-Stage Hardened
# ==========================================

FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm y herramientas básicas
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache libc6-compat openssl

# Copiar manifiestos y configuración base de TypeScript
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/fiscal-engine/package.json ./packages/fiscal-engine/
COPY apps/api/package.json ./apps/api/

# Instalar dependencias permitiendo build scripts de Prisma y bcrypt
RUN pnpm install --no-frozen-lockfile

# Copiar código fuente
COPY packages/database ./packages/database
COPY packages/fiscal-engine ./packages/fiscal-engine
COPY apps/api ./apps/api

# Generar Prisma Client
RUN cd packages/database && npx prisma generate

# Compilar librerías y API
RUN pnpm --filter @factura-ecf/database run build
RUN pnpm --filter @factura-ecf/fiscal-engine run build
RUN pnpm --filter @factura-ecf/api run build

# ==========================================
# Runner de Producción (Minimal & Secure)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache curl openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Usuario no privilegiado para seguridad
USER node

# Copiar build y node_modules de producción
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/v1/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
