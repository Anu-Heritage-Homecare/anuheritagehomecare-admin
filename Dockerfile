# syntax=docker/dockerfile:1

##########################################################
# Stage 1: build the static site with Vite
##########################################################
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public, build time API base URL baked into the bundle. Vite only exposes VITE_
# prefixed variables to the browser, so NEVER pass secrets as build args here.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

##########################################################
# Stage 2: serve the static build with nginx
##########################################################
FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# The nginx base image runs nginx in the foreground by default.
