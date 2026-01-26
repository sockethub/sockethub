# syntax=docker.io/docker/dockerfile:1.7-labs
ARG LOG_LEVEL=info
ARG bun_version=latest
FROM oven/bun:${bun_version} AS base
ARG bun_version
ARG LOG_LEVEL
ENV LOG_LEVEL=${LOG_LEVEL}
RUN echo "Building Sockethub docker image with Bun version ${bun_version}"

FROM base AS build
WORKDIR /app
COPY . ./
RUN apt update && apt install python3 python3-pip make g++ -y
RUN bun install
RUN bun run build
CMD DEBUG=secure-store*,sockethub* /app/packages/sockethub/bin/sockethub --host 0.0.0.0

FROM base AS prod
WORKDIR /app
COPY --exclude=node_modules --from=build /app ./
RUN bun install --production
CMD DEBUG=secure-store*,sockethub* /app/packages/sockethub/bin/sockethub --host 0.0.0.0
