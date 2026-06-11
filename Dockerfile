# syntax=docker.io/docker/dockerfile:1.7-labs
# Sockethub runs on Node.js in production. Bun is used only as the build tool
# (it produces node-target ESM output); the final runtime image is node-only.
ARG LOG_LEVEL=info
ARG bun_version=latest

# --- build stage: bun (build tooling only) ---------------------------------
FROM oven/bun:${bun_version} AS build
ARG LOG_LEVEL
WORKDIR /app
COPY . ./
RUN apt update && apt install python3 python3-pip make g++ -y
RUN bun install
RUN bun run build
# Prune to production dependencies (node-compatible node_modules) so the runtime
# image carries only what node needs at runtime.
RUN bun install --production

# --- prod stage: node (deployment runtime) ---------------------------------
# node:*-slim is Debian-based, matching the bun build image's glibc so any
# native modules compiled during install stay ABI-compatible.
FROM node:22-slim AS prod
ARG LOG_LEVEL=info
ENV LOG_LEVEL=${LOG_LEVEL}
WORKDIR /app
COPY --from=build /app ./
RUN echo "Running sockethub (prod) on node: LOG_LEVEL=${LOG_LEVEL}"
CMD ["node", "/app/packages/sockethub/bin/sockethub", "--host", "0.0.0.0"]
