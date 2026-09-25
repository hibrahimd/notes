FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++

# Bagimliliklar. npm onbellegi katmanda degil cache mount'ta durur: her
# deploy'da paketler yeniden indiriliyordu.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,id=notal-npm-alpine,target=/root/.npm \
    npm ci

# Builder deps'ten turuyor. Onceden "FROM base" idi ve node_modules
# deps'ten kopyalaniyordu; her deploy'da ~1 GB'lik bir katman kopyasi ve
# 7 saniye demekti. Devralinca kopya hic olusmuyor.
FROM deps AS builder
WORKDIR /app
COPY . .

# Turbopack derleme onbellegi .next/cache altinda tutuluyor; mount sayesinde
# deploy'lar arasi korunuyor (bkz. next.config.ts). Yalnizca bu alt dizin
# mount: .next/standalone ciktisi katmanda kaliyor.
RUN --mount=type=cache,id=notal-next-build,target=/app/.next/cache \
    npm run build

# Migration ve bakim betikleri icin gereken en kucuk agac.
# Calisan uygulama bunlari kullanmiyor: .next/standalone kendi kirpilmis
# node_modules'unu tasiyor ve @prisma/client, pg gibi paketler orada.
# Buraya yalnizca standalone'da olmayanlar giriyor: prisma CLI (migrate),
# dotenv (prisma.config.ts import ediyor) ve tsx (scripts/*.ts).
# Surumler package-lock'tan birebir aliniyor; caret araligi birakilirsa
# prisma CLI client'tan farkli bir surume cikabiliyor.
FROM base AS tools
# Bos bir dizine kuruluyor: package.json yanindayken "npm i <paket>" tum
# projeyi de kuruyor ve next geri geliyor (imaji 300 MB sisirmisti).
WORKDIR /tools
COPY package-lock.json /lock/package-lock.json
RUN --mount=type=cache,id=notal-npm-alpine,target=/root/.npm \
    PRISMA=$(node -p "require('/lock/package-lock.json').packages['node_modules/prisma'].version") \
    DOTENV=$(node -p "require('/lock/package-lock.json').packages['node_modules/dotenv'].version") \
    TSX=$(node -p "require('/lock/package-lock.json').packages['node_modules/tsx'].version") \
    && npm i --no-save --omit=optional \
         prisma@$PRISMA dotenv@$DOTENV tsx@$TSX

# Calisma imaji. Derleme araclari (python3/make/g++) bilerek yok:
# yalnizca native paket derlemek icin gerekiyorlar ve ~300 MB yer kapliyorlar.
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

# standalone'un uzerine eklenir, ezmez: farkli paketler
COPY --from=tools /tools/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
