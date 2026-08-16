FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (prisma generate runs as part of build script)
RUN npm run build

# Migration ve bakim betikleri icin ayri, uretim-only agac.
# Calisan uygulamanin bunlara ihtiyaci yok: .next/standalone gerekli
# paketleri kendi icinde tasiyor. Ayri tutulmasinin sebebi imaj boyutu —
# tam agac (gelistirme bagimliliklariyla) 1 GB, bu ~900 MB.
FROM base AS tools
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# next/react burada gereksiz: calisan uygulama .next/standalone icindeki
# kendi kopyasini kullaniyor, bu agac yalnizca migration ve bakim betikleri
# icin. Ayni dizine kopyalandiklari icin buradaki tam surum standalone'un
# kirpilmis surumunu eziyor ve imaji sisiriyordu.
RUN npm ci --omit=dev \
  && rm -rf node_modules/next node_modules/@next \
            node_modules/react node_modules/react-dom \
            node_modules/lucide-react

# Production image. Derleme araclari (python3/make/g++) bilerek yok:
# yalnizca native paket derlemek icin gerekiyorlar ve calisma imajinda
# ~300 MB yer kapliyorlardi.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data/notal-storage \
  && chown nextjs:nodejs /data/notal-storage

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/package.json ./package.json

# Yalnizca `prisma migrate deploy` ve bakim betikleri icin
COPY --from=tools /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
