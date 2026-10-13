FROM node:20-alpine

LABEL maintainer="tezhrec"
LABEL description="Graywolf APRS 7\" Tablet Web Client"

WORKDIR /app

# Zero external npm dependencies - copy application source directly
COPY package.json server.mjs ./
COPY public ./public

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.mjs"]
