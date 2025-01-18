ARG node_version=22
ARG config=/app/sockethub.config.json
FROM node:${node_version} AS base
ARG node_version
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@9.x --activate
RUN echo "Building Sockethub docker image with Node version ${node_version}"

FROM base AS build
COPY . /src
WORKDIR /src
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
RUN pnpm deploy --filter=sockethub --prod /deploy

FROM base AS test
COPY --from=build /src /app
WORKDIR /app
EXPOSE 10650
CMD DEBUG=secure-store*,sockethub* /app/packages/sockethub/bin/sockethub --examples --host 0.0.0.0 -c /app/test/sockethub.config.docker.json

FROM base AS prod
COPY --from=build /deploy /app
WORKDIR /app
EXPOSE 10550
CMD DEBUG=secure-store*,sockethub* /app/packages/sockethub/bin/sockethub -c ${config} --host 0.0.0.0
