ENV NODE_VERSION=16
FROM node:${NODE_VERSION}
MAINTAINER Ben Kero <ben.kero@gmail.com>
RUN ECHO "Building Sockethub docker image with Node version ${NODE_VERSION}"

RUN mkdir -p /app
WORKDIR /app
ADD . /app

RUN yarn install
RUN npx lerna bootstrap
RUN npx lerna run build

ADD packages/sockethub/config.json.example /app/packages/sockethub/config.json

EXPOSE 10550
CMD DEBUG=sockethub* /app/packages/sockethub/bin/sockethub --examples --host 0.0.0.0
