# Kaivaryn — Next.js 14 + Prisma SQLite (single free web service)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./prod.db"
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/packages ./packages
# Ensure data dir for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
# db push + seed on boot if empty, then start
CMD ["sh", "-c", "export DATABASE_URL=\"${DATABASE_URL:-file:/app/data/kaivaryn.db}\" && npx prisma db push && npx tsx prisma/seed.ts && npx next start -p ${PORT:-3000}"]
