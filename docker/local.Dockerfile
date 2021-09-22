# syntax=docker/dockerfile:1.2

# One can override this using --build-arg when building the docker image from this file.
ARG DATA_PATH=/nimiq
ARG PACKAGING=1

#---------------------------- BUILD NIMIQ - BASE -------------------------------
FROM node:14-buster as base

# Install build dependencies
RUN apt-get update \
    && apt-get --no-install-recommends -y install build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create build directory
WORKDIR /build

# Try to copy the repository from the current build context into the
# container. Assuming that this file is in its usual location within the
# core repository, the build context can be simply set to the current
# working directory (".").
COPY . .

#---------------------------- BUILD NIMIQ - BUILD ------------------------------
FROM base as builder

# Install, Build & Test
ARG PACKAGING
RUN --mount=type=cache,sharing=locked,target=/usr/local/share/.cache/yarn \
    yarn --frozen-lockfile
RUN yarn lint
RUN yarn lint-types
RUN yarn test-node

#---------------------------- BUILD NIMIQ - DEPS -------------------------------
FROM base as installer

# Install and build production dependencies
ARG PACKAGING
RUN --mount=type=cache,sharing=locked,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --production

#---------------------------- BUILD NIMIQ - NODE -------------------------------
FROM node:14-buster-slim

# Install tini - a tiny init for containers
RUN apt-get update \
    && apt-get --no-install-recommends -y install tini \
    && rm -rf /var/lib/apt/lists/*

# We're going to execute nimiq in the context of its own user, what else?
ENV USER=nimiq
RUN groupadd -r -g 999 ${USER} \
    && useradd -r -g ${USER} -u 999 -s /sbin/nologin -c "User with restricted privileges for Nimiq daemon" ${USER}

# Create data directory for the nimiq process
ARG DATA_PATH
RUN mkdir -p ${DATA_PATH} && chown ${USER}:root ${DATA_PATH}
VOLUME ${DATA_PATH}
WORKDIR ${DATA_PATH}

# Copy production dependencies from installer and built files from builder
COPY --from=installer /build/package.json /build/yarn.lock  /usr/share/nimiq/
COPY --from=installer /build/node_modules                   /usr/share/nimiq/node_modules
COPY --from=builder   /build/*.md                           /usr/share/nimiq/
COPY --from=builder   /build/build                          /usr/share/nimiq/build
COPY --from=builder   /build/clients                        /usr/share/nimiq/clients
COPY --from=builder   /build/dist                           /usr/share/nimiq/dist
COPY --from=builder   /build/doc                            /usr/share/nimiq/doc

# Execute client as non-root user
USER ${USER}

# Documentation
EXPOSE 8443 8648 8649

# Just execute the nimiq process. One can customize the created container easily
# to one's needs by (at least) the following options:
# - supply your own arguments to the entrypoint while creating the container, e.g.
#    docker run nimiq/nodejs-client --miner
# - just bind mount your own nimiq.conf to the container at /etc/nimiq/nimiq.conf
#   then you can just create the container like (assuming the config is in the
#   current working directory)
#     docker run -v $(pwd)/nimiq.conf:/etc/nimiq/nimiq.conf nimiq/nodejs-client --config=/etc/nimiq.conf
# (- of course, you can combine and modify these options suitable to your needs)
ENTRYPOINT [ "/usr/bin/tini", "--", "/usr/share/nimiq/clients/nodejs/nimiq" ]
