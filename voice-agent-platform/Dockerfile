# Dev container -- runs `next dev` against a bind-mounted source tree so
# active development (this project changes every session) doesn't require
# an image rebuild per edit. A separate anonymous volume for node_modules
# keeps the container's own install isolated from the host's.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 8090

CMD ["npm", "run", "dev"]
