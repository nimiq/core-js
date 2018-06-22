# Docker

A Dockerfile is provided which allows for creating a simple nodejs client image.

## Building the Docker image
```
docker build
  -t nimiq/nodejs-client .
```

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
The options are identical to the nodejs client command line options, since
the docker container basically invokes the client directly.

### Check status
`docker logs -f <instance_id_or_name>`

