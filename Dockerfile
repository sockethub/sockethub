FROM "node:6"
MAINTAINER Ben Kero <ben.kero@gmail.com>

ADD packages/sockethub/package.json /tmp/package.json
ADD packages/sockethub/yarn.lock /tmp/yarn.lock
RUN cd /tmp && npm install
RUN mkdir -p /app
ADD packages/sockethub/config.json.example /app/config.json
RUN cp -a /tmp/node_modules /app/

WORKDIR /app
ADD . /app

EXPOSE 10550
CMD DEBUG=* /app/bin/sockethub --examples --host 0.0.0.0
