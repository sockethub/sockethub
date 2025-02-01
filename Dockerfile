ARG bun_version=22
FROM oven/bun:${bun_version} AS base
ARG bun_version
RUN echo "Building Sockethub docker image with Bun version ${bun_version}"

FROM base AS build
COPY . /src
WORKDIR /src
RUN bun install --frozen-lockfile
RUN bun run build
RUN bun run deploy --filter=sockethub --prod /deploy

FROM oven/bun:${bun_version}-slim AS prod
COPY --from=build /deploy /app
WORKDIR /app
CMD DEBUG=secure-store*,sockethub* /app/bin/sockethub --host 0.0.0.0
