# Stage 1: Build stage
FROM node:22-alpine AS builder

# Install build dependencies if needed (like python for native modules)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files from server directory (for better layer caching)
COPY server/package.json server/yarn.lock ./

# Install dependencies without running scripts (skip prepare hook)
# Use network-timeout to avoid slow builds, and enable cache if available
RUN yarn install --frozen-lockfile --ignore-scripts --network-timeout 100000

# Create prisma directory first
RUN mkdir -p prisma

# Copy server source files first
COPY server/ ./

# Copy the actual schema file (not symlink) - do this AFTER server/ to ensure it overwrites symlink
COPY db/schema.prisma ./prisma/schema.prisma

# Generate Prisma Client (now that schema is available)
RUN npx prisma generate

# Build TypeScript
RUN yarn build

# Stage 2: Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files from builder
COPY --from=builder /app/package.json /app/yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production --network-timeout 100000 && \
    yarn cache clean

# Copy Prisma schema and generated client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security (combined for fewer layers)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port (defaults to 8080, configurable via PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Optimize Node.js for 512MB memory constraint
# --max-old-space-size sets heap limit (leave room for system, use ~400MB)
ENV NODE_OPTIONS="--max-old-space-size=400"

# Start the application
CMD ["node", "dist/index.js"]

