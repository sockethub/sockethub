FROM ubuntu
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y python-software-properties python g++ make
RUN apt-get install -y redis-server
RUN apt-get install -y nodejs
RUN npm install
RUN ./bin/sockethub
