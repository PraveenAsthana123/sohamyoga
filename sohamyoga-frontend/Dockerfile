# ── Dependencies stage ────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /workspace
COPY sohamyoga-frontend/package.json sohamyoga-frontend/package-lock.json ./sohamyoga-frontend/
COPY packages/shared-backend/package.json ./packages/shared-backend/
WORKDIR /workspace/sohamyoga-frontend
RUN npm ci

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /workspace/sohamyoga-frontend

COPY --from=deps /workspace/sohamyoga-frontend/node_modules ./node_modules
COPY packages/shared-backend /workspace/packages/shared-backend
COPY sohamyoga-frontend .

ARG NEXT_PUBLIC_API_URL=
ARG INTERNAL_API_URL=http://backend:5070
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S slpgroup && adduser -S slpuser -G slpgroup

COPY --from=builder --chown=slpuser:slpgroup /workspace/sohamyoga-frontend/.next/standalone/sohamyoga-frontend ./
COPY --from=builder --chown=slpuser:slpgroup /workspace/sohamyoga-frontend/.next/static ./.next/static
COPY --from=builder --chown=slpuser:slpgroup /workspace/sohamyoga-frontend/public ./public

USER slpuser

EXPOSE 3010
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3010 || exit 1

CMD ["node", "server.js"]
