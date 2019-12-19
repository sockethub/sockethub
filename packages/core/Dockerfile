FROM "node:6"
MAINTAINER Ben Kero <ben.kero@gmail.com>

ADD package.json /tmp/package.json
ADD package-lock.json /tmp/package-lock.json
RUN cd /tmp && npm install
RUN mkdir -p /app
ADD config.json.example /app/config.json
RUN cp -a /tmp/node_modules /app/

WORKDIR /app
ADD . /app

EXPOSE 10550
CMD DEBUG=* /app/bin/sockethub --examples --host 0.0.0.0
