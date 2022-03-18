ARG node_version=16
FROM node:${node_version}
ARG node_version
LABEL authors="Ben Kero <ben.kero@gmail.com>, Nick Jennings <nick@silverbucket.net>"
RUN echo "Building Sockethub docker image with Node version ${node_version}"

WORKDIR /app

# Remove unwanted preinstalled version of yarn
RUN rm /usr/local/bin/yarn
RUN rm /usr/local/bin/yarnpkg
RUN npm install -g yarn@latest

COPY . .

RUN yarn deps
RUN yarn build

COPY apps/sockethub/sockethub.config.json /app/apps/sockethub.config.json

EXPOSE 10550
CMD DEBUG=sockethub* /app/apps/sockethub/bin/sockethub --host 0.0.0.0 -c /app/apps/sockethub.config.json
