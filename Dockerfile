FROM node:8.1
# Usage:
# Use existing host SSL keys
# docker run -d -p 8081:8081 -v /etc/letsencrypt/:/etc/letsencrypt/ --name "nimiq" nimiq
# Mount volume or data until dynamic private key can be used
# docker run -d -p 8080:8080 -v /etc/letsencrypt/:/etc/letsencrypt/ -v /data/:/core/nimiq/core/dist/database --name "nimiq" nimiq


ENV GIT_REPO="https://github.com/nimiq-network/core"
ENV DOMAIN="node.nimiq.io"
ENV KEY="/etc/letsencrypt/live/nimiq.io/privkey.pem"
ENV CRT="/etc/letsencrypt/live/nimiq.io/cert.pem"
ENV PORT="8080"

RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y git python openssl build-essential software-properties-common

RUN git clone https://github.com/nimiq-network/core
RUN cd /core && npm install && npm run build

VOLUME /core/dist/database/
EXPOSE ${PORT}
ENTRYPOINT node /core/clients/nodejs/index.js --host ${DOMAIN} --port ${PORT} --key ${KEY} --cert ${CRT}
