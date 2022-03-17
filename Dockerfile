ARG node_version=16
FROM node:${node_version}
ARG node_version
MAINTAINER Ben Kero <ben.kero@gmail.com>
RUN echo "Building Sockethub docker image with Node version ${node_version}"

RUN mkdir -p /app
WORKDIR /app
ADD . /app

RUN yarn deps
RUN yarn build

ADD apps/sockethub/sockethub.config.json /app/sockethub.config.json

EXPOSE 10550
CMD DEBUG=sockethub* /app/apps/sockethub/bin/sockethub --host 0.0.0.0 -c /app/sockethub.config.json
