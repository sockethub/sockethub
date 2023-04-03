ARG node_version=19
FROM node:${node_version}
ARG node_version
LABEL authors="Ben Kero <ben.kero@gmail.com>, Nick Jennings <nick@silverbucket.net>"
RUN echo "Building Sockethub docker image with Node version ${node_version}"

WORKDIR /app

RUN curl -fsSL "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64" -o /bin/pnpm; chmod +x /bin/pnpm;

COPY . .

RUN pnpm install
RUN pnpm build

CMD DEBUG=sockethub* /app/packages/sockethub/bin/sockethub --examples --host 0.0.0.0 -c /app/test/sockethub.config.docker.json

EXPOSE 10650
