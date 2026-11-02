# ==============================================================================
# SitePulse — Production Dockerfile (Express Backend & Frontend Assets)
# Multi-stage build for minimal production image footprint & security
# ==============================================================================

# Stage 1: Dependency Installation
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Run as non-root user for container security
USER node

# Copy dependencies and application source
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node backend ./backend
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node js ./js
COPY --chown=node:node index.html script.js style.css config.js ./

EXPOSE 3000

# Built-in container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "backend/src/server.js"]
