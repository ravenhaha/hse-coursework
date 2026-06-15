FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_API_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.29-alpine

ENV BACKEND_UPSTREAM=backend:8000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
