# Docker

A Dockerfile is provided which allows for creating your own backbone image using the following arguments.

| Argument | Description |
| --- | --- |
| BRANCH  | Defaults to *master* but can be any available git branch  |
| PORT  | Defaults to TCP port *8080* |
| DOMAIN  | Domain to be used for hosting the backbone node  |
| KEY  | Path to an existing certificate key for the DOMAIN  |
| CRT  | Path to an existing signed certificate for the DOMAIN  |
| WALLET_SEED  | Pre-existing wallet private key  |

## Building the Docker image using the above arguments
```
docker build \
  --build-arg DOMAIN=<DOMAIN> \
  --build-arg BRANCH=<BRANCH> \
  --build-arg WALLET_SEED=<WALLET_SEED> \
  --build-arg KEY=<KEY> \
  --build-arg CRT=<CRT> \
  --build-arg PORT=<PORT> \
  -t nimiq .
```

## Running an instance of the image

`docker run -d -p 8080:8080 -v /etc/letsencrypt/:/etc/letsencrypt/ --name "nimiq" nimiq`

Note that you can override any of the arguments which were baked into the image at runtime with exception to the *BRANCH*. The -v flag here allows for mapping a local system path into the container for the purpose of using the existing *DOMAIN* certificates.

### Check status
`docker logs -f <instance_id_or_name>`