# Stage 1: Build stage
FROM node:22-alpine AS builder

# Install build dependencies if needed (like python for native modules)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files from server directory
COPY server/package.json server/yarn.lock ./

# Install dependencies without running scripts (skip prepare hook)
# We'll run prisma generate manually after copying the schema
RUN yarn install --frozen-lockfile --ignore-scripts

# Create prisma directory and copy the actual schema file (not symlink)
RUN mkdir -p prisma
COPY db/schema.prisma ./prisma/schema.prisma

# Copy rest of server source files (exclude prisma since we already have it)
COPY server/ ./
# Ensure we have the real schema file, not symlink
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
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copy Prisma schema and generated client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

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

