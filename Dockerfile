ARG bun_version=1.2.2
FROM oven/bun:${bun_version} AS base
ARG bun_version
RUN echo "Building Sockethub docker image with Bun version ${bun_version}"

FROM base AS build
COPY . /app
WORKDIR /app
RUN bun install --frozen-lockfile
RUN bun run build
CMD DEBUG=secure-store*,sockethub* /app/bin/sockethub --host 0.0.0.0
