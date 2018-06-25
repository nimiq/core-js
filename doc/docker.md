# Docker

The following Dockerfile(s) allow for creating simple Node.js client images. Depending on the desired build method and source origin, one can choose between the following Dockerfile(s):

* **Dockerfile_deb**
The Dockerfile will create a container which uses Node.js client from the latest stable Nimiq DEB package. 
This is mostly recommended for any stable deployment of the Node.js client.

* **Dockerfile_git**
The Dockerfile will checkout the latest revision of a given branch from the *core* repository. By default, the *master* branch will be used. One can select a different branch by specifying the *BRANCH* build argument when building the container, i.e. ```--build-arg BRANCH=foobar``` with *foobar* being replaced by the branch that should be used.
You can use this container to explore the latest cutting-edge updates or a specific feature branch from the *core* repository. The *master* branch should be usually be stable, but nonetheless it is not specifically recommended to use this version for production deployments.

* **Dockerfile_repo**
The Dockerfile tries to copy the entire *core* repository from the current build context. If the Dockerfile is located at its usual location within the *core* repository, one can just the repository, i.e. most likely the current working directory, as build context.
This container is specifically suited for development, since it will be created from the current repository state including any local changes.

## Building the Docker image
```
docker build
  -t nimiq/nodejs-client
  -f ${DOCKERFILE}
  (--build-arg BRANCH=foobar)
  .
```

You should replace ```${DOCKERFILE}``` with one of the Dockerfiles explained above.

## Running an instance of the image

One can customize the created container easily to one's needs by (at least) the following options:
 - supply your own arguments to the entrypoint while creating the container, e.g.
    ```
      docker run
        nimiq/nodejs-client
        $ARG
        ...
    ```
 - just bind mount your own nimiq.conf to the container at /etc/nimiq/nimiq.conf
   then you can just create the container like (assuming the config is in the
   current working directory)
    ```
     docker run
       -v $(pwd)/nimiq.conf:/etc/nimiq/nimiq.conf
       nimiq/nodejs-client
       --config=/etc/nimiq/nimiq.conf
    ```
 - (of course, you can combine and modify these options suitable to your needs)

The -v flag allows for mapping a local system path into the container, i.e.
the nimiq.conf file in above example. You can also use this for the purpose
of using your existing domain certificates.

```
docker run
  -v /etc/letsencrypt:/etc/letsencrypt
  -v $(pwd)/nimiq.conf:/etc/nimiq/nimiq.conf
  nimiq/nodejs-client
  --cert=$CERT
  --key=$KEY
  --config=/etc/nimiq/nimiq.conf
```

If in doubt regarding the command line options to the container, one can just
run the image directly without any options, e.g.
 ```docker run --rm nimiq/nodejs-client```.
The options are identical to the Node.js client command line options, since
the docker container basically invokes the client directly.

### Check status
`docker logs -f <instance_id_or_name>`

