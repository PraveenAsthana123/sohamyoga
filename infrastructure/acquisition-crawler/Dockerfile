FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends procps \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV CRAWLEE_STORAGE_DIR=/data/crawlee
ENTRYPOINT ["npm","run","crawl","--"]
