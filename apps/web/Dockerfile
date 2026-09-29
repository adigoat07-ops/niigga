FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json* ./packages/shared/

RUN npm ci

COPY apps/web ./apps/web
COPY packages ./packages

RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build --workspace=web

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app ./

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=web"]
