FROM node:8.1

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

# mandatory arguments
ARG WALLET_ADDRESS

ENV WALLET_ADDRESS="${WALLET_ADDRESS}"

# optional arguments
ARG THREADS="4"
ARG NETWORK="main"
ARG EXTRA_DATA=""
ARG STATISTICS="60"

ENV THREADS="${THREADS}"
ENV NETWORK="${NETWORK}"
ENV EXTRA_DATA="${EXTRA_DATA}"
ENV STATISTICS="${STATISTICS}"

ENTRYPOINT UV_THREADPOOL_SIZE=${THREADS} node /core/clients/nodejs/index.js --miner=${THREADS} --network=${NETWORK} --statistics=${STATISTICS} --wallet-address=${WALLET_ADDRESS} --dumb
