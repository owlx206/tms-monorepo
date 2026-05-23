ARG ENV_FILE=.env.prod

FROM node:20-alpine AS frontend-builder
WORKDIR /build/tms-frontend

ARG ENV_FILE

COPY tms-frontend/package*.json ./
RUN npm ci

COPY ${ENV_FILE} /build/.env
COPY tms-frontend/ ./
RUN set -a && . /build/.env && set +a && npm run build -- --mode "${NODE_ENV:-production}"

FROM node:20-alpine AS backend-builder
WORKDIR /build/tms-backend

COPY tms-backend/package*.json ./
RUN npm ci

COPY tms-backend/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /usr/app

ARG ENV_FILE

ENV HOST=0.0.0.0
ENV PORT=4000
ENV FRONTEND_URL=http://localhost:4000
ENV BACKEND_URL=http://localhost:4000
ENV FRONTEND_DIST_DIR=/usr/app/frontend

COPY tms-backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY ${ENV_FILE} ./.env
COPY --from=backend-builder /build/tms-backend/dist ./dist
COPY --from=frontend-builder /build/tms-frontend/dist ./frontend

EXPOSE 4000

CMD ["sh", "-c", "set -a && . /usr/app/.env && set +a && exec node dist/index.js"]
