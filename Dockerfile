FROM node:8.1
# Build Use existing host SSL keys for domain node.nimiq.io, ensure that you replace all these with your own configuration requirements
# docker build --build-arg DOMAIN=node.nimiq.io --build-arg BRANCH=master --build-arg WALLET_SEED="..." --build-arg KEY="/etc/letsencrypt/live/nimiq.io/privkey.pem" --build-arg CRT="/etc/letsencrypt/live/nimiq.io/cert.pem" --build-arg PORT="8080" -t nimiq .
#RUN
# docker run -d -p 8080:8080 -v /etc/letsencrypt/:/etc/letsencrypt/ --name "nimiq" nimiq
#Check status
# docker logs -f <instance_id>

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
ENV WALLT_SEED="${WALLET_SEED}"
ENV KEY="${KEY}"
ENV CRT="${CRT}"
ENV PORT="${PORT}"

RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y python build-essential

RUN wget ${RELEASE} && tar -xvzf ./${BRANCH}.tar.gz
RUN cd /core-${BRANCH} && npm install && npm run build

EXPOSE ${PORT}
ENTRYPOINT node /core-${BRANCH}/clients/nodejs/index.js --host ${DOMAIN} --port ${PORT} --key ${KEY} --cert ${CRT} --wallet-seed=${WALLET_SEED} --miner
