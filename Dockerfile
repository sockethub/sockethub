ARG node_version=22
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

FROM node:${node_version}-slim AS prod
COPY --from=build /deploy /app
WORKDIR /app
CMD DEBUG=secure-store*,sockethub* /app/bin/sockethub -c sockethub.config.json --host 0.0.0.0
