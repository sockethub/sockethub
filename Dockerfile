FROM ubuntu:precise
RUN echo "deb http://archive.ubuntu.com/ubuntu precise universe" >> /etc/apt/sources.list
RUN apt-get update
RUN apt-get install -y python-software-properties python g++ make redis-server libicu-dev
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y nodejs
ADD . ./sockethub
RUN cd sockethub && npm install
CMD cd sockethub && ./bin/docker.sh
EXPOSE 10550
