FROM node:8.1

# Environment Variables which can be overriden at runtime
ENV RELEASE="https://github.com/nimiq-network/core/archive/master.tar.gz"

RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y python build-essential
RUN apt-get install git

RUN git clone https://github.com/nimiq-network/core.git
WORKDIR /core
RUN npm install && npm run build
RUN cd clients/nodejs && npm install
RUN npm run prepare
RUN npm install -g node-gyp
RUN node-gyp configure
RUN node-gyp build
RUN node_modules/.bin/gulp prepare-packages

# mandatory
ARG PRIVATE_KEY_PATH=""
ARG CERT_PATH=""
ARG WALLET_ADDRESS
ARG HOST

ENV PRIVATE_KEY_PATH="${PRIVATE_KEY_PATH}"
ENV CERT_PATH="${CERT_PATH}"
ENV WALLET_ADDRESS="${WALLET_ADDRESS}"
ENV HOST="${HOST}"

# optional
ARG THREADS="4"
ARG NETWORK="main"
ARG EXTRA_DATA=""
ARG PORT="80"
ARG STATISTICS="60"

ENV THREADS="${THREADS}"
ENV NETWORK="${NETWORK}"
ENV EXTRA_DATA="${EXTRA_DATA}"
ENV PORT="${PORT}"
ENV STATISTICS="${STATISTICS}"

ADD ${PRIVATE_KEY_PATH} /privkey.pem
ADD ${CERT_PATH} /fullchain.pem

EXPOSE ${PORT}

ENTRYPOINT UV_THREADPOOL_SIZE=${THREADS} node /core/clients/nodejs/index.js --host ${HOST} --port ${PORT} --key /privkey.pem --cert /fullchain.pem --miner=${THREADS} --network=${NETWORK} --statistics=${STATISTICS} --wallet-address=${WALLET_ADDRESS}
