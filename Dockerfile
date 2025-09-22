# Bridge Service Dockerfile (root-level for Railway auto-deploy)
FROM node:20-alpine

WORKDIR /app

# System deps used by some node modules and healthchecks
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S eliza -u 1001

# Install deps first (better layer cache)
COPY package*.json ./
COPY tsconfig.json ./ 2>/dev/null || true
RUN npm ci --only=production && npm cache clean --force

# Copy source
COPY --chown=eliza:nodejs . .

# Optional build step (repo is JS; keep non-fatal)
RUN npm run build || echo "Build skipped"

USER eliza

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENV PORT=3000
CMD ["npm", "run", "start:bridge"]

