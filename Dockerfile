FROM nodesource/node:trusty
MAINTAINER Ben Kero <ben.kero@gmail.com>

RUN apt-get update
RUN apt-get install -y redis-server libicu-dev libexpat1 git-core

ENV USER root

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /sockethub && cp -a /tmp/node_modules /sockethub/
WORKDIR /sockethub
ADD . /sockethub

EXPOSE 10550
CMD service redis-server start && /sockethub/bin/sockethub
