FROM node:8.1

# Arguments which are to be defined at build time
ARG DOMAIN
ARG BRANCH
ARG WALLET_SEED
ARG KEY
ARG CRT
ARG PORT="8080"

# Environment Variables which can be overriden at runtime
ENV BRANCH="${BRANCH}"
ENV RELEASE="https://github.com/nimiq-network/core/archive/${BRANCH}.tar.gz"
ENV DOMAIN="${DOMAIN}"
ENV WALLET_SEED="${WALLET_SEED}"
ENV KEY="${KEY}"
ENV CRT="${CRT}"
ENV PORT="${PORT}"

RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y python build-essential

RUN wget ${RELEASE} && tar -xvzf ./${BRANCH}.tar.gz
RUN cd /core-${BRANCH} && npm install && npm run build
RUN cd /core-${BRANCH}/clients/nodejs && npm install
RUN cd /core-${BRANCH} && npm run prepare

EXPOSE ${PORT}
ENTRYPOINT node /core-${BRANCH}/clients/nodejs/index.js --host ${DOMAIN} --port ${PORT} --key ${KEY} --cert ${CRT} --wallet-seed=${WALLET_SEED} --miner
