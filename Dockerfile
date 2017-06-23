FROM node:8.1

ENV GIT_REPO="https://github.com/nimiq-network/core"
ENV DOMAIN="localhost"
ENV SSL_SUBJECT="/C=CR/ST=State/L=Costa Rica/O=Nimiq/OU=orginization/CN=${DOMAIN}"
ENV PORT="8080"
ENV KEY="/core/server.key"
ENV CERT="/core/server.crt"


RUN apt-get update && apt-get -y upgrade 
RUN apt-get install -y git python openssl build-essential

RUN git clone https://github.com/nimiq-network/core
RUN cd /core && npm install && ./node_modules/.bin/gulp build
RUN openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 -keyout /core/server.key -out /core/server.crt -subj "${SSL_SUBJECT}"

EXPOSE ${HOST}:${PORT}
ENTRYPOINT node /core/clients/nodejs/index.js --host ${DOMAIN} --port ${PORT} --key ${KEY} --cert ${CERT}
