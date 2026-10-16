# syntax=docker/dockerfile:1
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    --fetch-retries=4 \
    --fetch-retry-mintimeout=10000 \
    --fetch-retry-maxtimeout=60000 \
    --fetch-timeout=120000 \
    --loglevel=info

FROM node:24-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY sql ./sql
COPY data ./data
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]

FROM nginx:1.28-alpine AS web
ARG DASHBOARD_ENTRY=penyelenggara.html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY frontend /usr/share/nginx/html
RUN test -s /usr/share/nginx/html/css/styles.css \
    && test -s /usr/share/nginx/html/vendor/d3.min.js \
    && cp /usr/share/nginx/html/${DASHBOARD_ENTRY} /usr/share/nginx/html/index.html
EXPOSE 8080
