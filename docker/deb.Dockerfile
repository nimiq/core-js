ARG DATA_PATH=/nimiq

#---------------------------- BUILD NIMIQ - BUILD ------------------------------
FROM node:14-buster as builder
# Get repo key and install it
RUN wget -qO - https://www.nimiq.com/nimiq-signing-key.pub | apt-key add -

#---------------------------- BUILD NIMIQ - NODE -------------------------------
FROM node:14-buster-slim

# Install the repo
COPY --from=builder /etc/apt/trusted.gpg /etc/apt/
RUN echo "deb [arch=amd64] http://repo.nimiq.com/deb stable main" > /etc/apt/sources.list.d/nimiq.list

# Install nimiq and tini
RUN apt-get update \
    && apt-get --no-install-recommends -y install nimiq tini \
    && rm -rf /var/lib/apt/lists/*

# We're going to execute nimiq in the context of its own user, what else?
ENV USER=nimiq

# Create data directory for the nimiq process
ARG DATA_PATH
RUN mkdir -p ${DATA_PATH} && chown ${USER}:root ${DATA_PATH}
VOLUME ${DATA_PATH}
WORKDIR ${DATA_PATH}

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
ENTRYPOINT [ "/usr/bin/tini", "--", "/usr/bin/nimiq" ]
