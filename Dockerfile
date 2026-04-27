# syntax=docker/dockerfile:1.7
# Multi-stage build for the VerdictCouncil frontend.
#   stage 1: install deps + Vite production build
#   stage 2: nginx-alpine serving the SPA on port 8080
#
# VITE_API_URL is baked at build time (Vite inlines `import.meta.env.*`),
# so each environment ships with its own image tag.

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
