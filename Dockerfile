# syntax=docker.io/docker/dockerfile:1.7-labs
ARG LOG_LEVEL=info
ARG bun_version=latest
FROM oven/bun:${bun_version} AS base
ARG bun_version
ARG LOG_LEVEL
RUN echo "Building Sockethub docker image with Bun version ${bun_version} and LOG_LEVEL=${LOG_LEVEL}"

FROM base AS build
WORKDIR /app
COPY . ./
RUN apt update && apt install python3 python3-pip make g++ -y
RUN bun install
RUN bun run build

FROM base AS prod
ARG LOG_LEVEL=info
ENV LOG_LEVEL=${LOG_LEVEL}
WORKDIR /app
COPY --exclude=node_modules --from=build /app ./
RUN bun install --production
RUN echo "Running sockethub (prod): LOG_LEVEL=${LOG_LEVEL} /app/packages/sockethub/bin/sockethub --host 0.0.0.0 "
CMD /app/packages/sockethub/bin/sockethub --host 0.0.0.0
