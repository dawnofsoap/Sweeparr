FROM node:20-alpine AS base

# Install OpenSSL compatibility for Prisma
RUN apk add --no-cache openssl openssl-dev libc6-compat

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Build the application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Build arguments for image labeling
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# OCI Image Labels
LABEL org.opencontainers.image.title="Sweeparr" \
      org.opencontainers.image.description="Sweep away old, unwatched, and unwanted media from your library" \
      org.opencontainers.image.url="https://github.com/dawnofsoap/Sweeparr" \
      org.opencontainers.image.source="https://github.com/dawnofsoap/Sweeparr" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="GPL-3.0"

# Environment defaults
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=file:/config/sweeparr.db

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sweeparr

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Create directories for config and logs
RUN mkdir -p /config /logs && chown -R sweeparr:nodejs /config /logs

USER sweeparr

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server/server/index.js"]
