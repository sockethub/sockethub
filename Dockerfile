ARG deno_version=1.46.1
FROM denoland/deno:${deno_version}
ARG deno_version
LABEL authors="Ben Kero <ben.kero@gmail.com>, Nick Jennings <nick@silverbucket.net>"
RUN echo "Building Sockethub docker image with Deno version ${deno_version}"

WORKDIR /app

COPY . .

CMD DEBUG=secure-store*,sockethub* /app/packages/sockethub/bin/sockethub --examples --host 0.0.0.0 -c /app/test/sockethub.config.docker.json

EXPOSE 10650
