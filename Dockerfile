FROM nodesource/xenial:latest
MAINTAINER Ben Kero <ben.kero@gmail.com>

RUN apt-get update && apt-get install -y git-core

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /app
ADD config.json.example /app/config.json
RUN cp -a /tmp/node_modules /app/

WORKDIR /app
ADD . /app

EXPOSE 10550
CMD DEBUG=* /app/bin/sockethub --examples --host 0.0.0.0
