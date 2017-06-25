FROM node:8.1
# Usage:
# Use existing host SSL keys
# docker run -d -p 8080:8080 -v /etc/letsencrypt/:/etc/letsencrypt/ --name "nimiq" nimiq
# Mount volume or data until dynamic private key can be used
# docker run -d -p 8080:8080 -v /etc/letsencrypt/:/etc/letsencrypt/ -v /data/:/core/nimiq/core/dist/database --name "nimiq" nimiq


ENV RELEASE="https://github.com/nimiq-network/core/archive/master.tar.gz"
ENV DOMAIN="node.nimiq.io"
ENV KEY="/etc/letsencrypt/live/nimiq.io/privkey.pem"
ENV CRT="/etc/letsencrypt/live/nimiq.io/cert.pem"
ENV PORT="8080"

RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y python build-essential

RUN wget ${RELEASE} && tar -xvzf ./master.tar.gz
RUN cd /core-master && npm install && npm run build

EXPOSE ${PORT}
ENTRYPOINT node /core-master/clients/nodejs/index.js --host ${DOMAIN} --port ${PORT} --key ${KEY} --cert ${CRT}
