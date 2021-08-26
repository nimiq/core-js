# One can override this using --build-arg when building the docker image from this file.
ARG DATA_PATH=/nimiq
ARG INSTALL_PATH=/nimiq-core

#---------------------------- BUILD NIMIQ - BUILD ------------------------------
FROM node:14-buster as builder

# Install build dependencies
RUN apt-get update && apt-get --no-install-recommends -y install build-essential && rm -rf /var/lib/apt/lists/*

# We need build args now
ARG INSTALL_PATH

# Create a working directory to build in
WORKDIR ${INSTALL_PATH}

# Try to copy the repository from the current build context into the
# container. Assuming that this file is in its usual location within the
# core repository, the build context can be simply set to the current
# working directory (".").
COPY . .

# Install, Build & Test
RUN yarn --frozen-lockfile
RUN yarn lint
RUN yarn lint-types
RUN yarn test-node

#---------------------------- BUILD NIMIQ - DEPS -------------------------------
FROM node:14-buster as installer

# Set working directory to install production dependencies in
ARG INSTALL_PATH
WORKDIR ${INSTALL_PATH}

# Install build dependencies
RUN apt-get update && apt-get --no-install-recommends -y install build-essential && rm -rf /var/lib/apt/lists/*

# Copy files for yarn
COPY package.json yarn.lock ./

# Install and build production dependencies
RUN yarn install --production --frozen-lockfile

#---------------------------- BUILD NIMIQ - NODE -------------------------------
FROM node:14-buster-slim

# We're going to execute nimiq in the context of its own user, what else?
ENV USER=nimiq
RUN useradd -m ${USER}

# Create working and data directories for the nimiq process
ARG DATA_PATH
RUN mkdir -p ${DATA_PATH} && chown ${USER}:root ${DATA_PATH}
ARG INSTALL_PATH
RUN mkdir -p ${INSTALL_PATH} && chown ${USER}:root ${INSTALL_PATH}

# Copy production dependencies from installer and built files from builder
WORKDIR ${INSTALL_PATH}
COPY --from=installer --chown=nimiq:root ${INSTALL_PATH}/package.json ${INSTALL_PATH}/yarn.lock ./
COPY --from=installer --chown=nimiq:root ${INSTALL_PATH}/node_modules ./node_modules
COPY --from=builder --chown=nimiq:root ${INSTALL_PATH}/*.md ./
COPY --from=builder --chown=nimiq:root ${INSTALL_PATH}/build ./build
COPY --from=builder --chown=nimiq:root ${INSTALL_PATH}/clients ./clients
COPY --from=builder --chown=nimiq:root ${INSTALL_PATH}/dist ./dist
COPY --from=builder --chown=nimiq:root ${INSTALL_PATH}/doc ./doc

# Execute client as non-root user
USER ${USER}
WORKDIR ${DATA_PATH}
ENV INSTALL_PATH=${INSTALL_PATH}

# Just execute the nimiq process. One can customize the created container easily
# to one's needs by (at least) the following options:
# - supply your own arguments to the entrypoint while creating the container, e.g.
#    docker run nimiq/nodejs-client --miner
# - just bind mount your own nimiq.conf to the container at /etc/nimiq/nimiq.conf
#   then you can just create the container like (assuming the config is in the
#   current working directory)
#     docker run nimiq/nodejs-client -v $(pwd)/nimiq.conf:/etc/nimiq/nimiq.conf --config=/etc/nimiq.conf
# (- of course, you can combine and modify these options suitable to your needs)
ENTRYPOINT [ "/bin/sh", "-c", "${INSTALL_PATH}/clients/nodejs/nimiq ${@}", "--" ]
