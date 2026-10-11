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
COPY --chown=node:node --from=build /app ./
RUN echo "Running sockethub (prod) on node: LOG_LEVEL=${LOG_LEVEL}"
RUN chown node:node /app
USER node
# node:*-slim ships no curl/wget, so probe with node's fetch. PORT is the same
# variable convict binds to sockethub.port, so overriding it moves both.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10550)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "/app/packages/sockethub/bin/sockethub", "--host", "0.0.0.0"]
