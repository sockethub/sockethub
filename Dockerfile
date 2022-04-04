ARG node_version=16
FROM node:${node_version}
ARG node_version
MAINTAINER Ben Kero <ben.kero@gmail.com>
RUN echo "Building Sockethub docker image with Node version ${node_version}"

RUN mkdir -p /app
WORKDIR /app
ADD . /app

RUN yarn run deps
RUN yarn run build

ADD packages/server/config.json.example /app/packages/server/config.json

EXPOSE 10550
CMD DEBUG=sockethub* /app/packages/server/bin/sockethub --examples --host 0.0.0.0
