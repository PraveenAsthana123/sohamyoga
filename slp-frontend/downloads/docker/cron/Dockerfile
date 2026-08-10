FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/cron ./src/cron
COPY src/domain ./src/domain
COPY tsconfig.json ./

# Install tsx for running TypeScript directly
RUN npm install -g tsx

# Health check — verifies Ollama reachability
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s \
  CMD wget -qO- ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}/api/tags | grep -q 'models' && echo OK

CMD ["tsx", "src/cron/runner.ts"]
