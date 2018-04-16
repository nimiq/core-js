# Full node Dockerfile

This ![Dockerfile]('./Dockerfile') builds a dumb node which is a miner that can connect and mine on the network however it does not add additional security to the network as other miner's can not connect to it.

If you are looking to mine with the simplest way going forward with minimal set up then this is the recommended approach.

### Dockerfile build parameters

The Dockerfile needs to be built with a list of parameters which much be specified in order to properly run

| Argument | Description | Is it Mandatory | Default Value
| --- | --- | --- | --- |
| WALLET_ADDRESS  | The wallet address you want NIM to mine to | Yes | |
| THREADS  | Number of threads/cores you want to run the Node.js miner with | No | 4 |
| NETWORK  | The blockchain network to mine on (e.g. can be main, dev, test) | No | main |
| EXTRA_DATA  | Extra data to pass within the hash - if you are running multiple miners to the same WALLET_ADDRESS then you should set this to a unique value, otherwise ignore this value | No | |
| PORT  | Port to expose your miner node to | No | 80 |
| STATISTICS  | The interval (seconds) to console log the Node.js output at | No | 60 |

You can build the Docker image by running the following example command:

```
docker build \
  --build-arg WALLET_ADDRESS=NQ14U61PLSPY13KM9MNCLRMAUKX313A70EFM \
  --build-arg THREADS=2 \
  --build-arg STATISTICS=10 \
  -t nimiq .
```

### Running the docker image

Once the Docker image builds successfully, you can then run the Docker a container via the previously built image:

```
docker run -it nimiq
```

### Troubleshooting docker failures

#### Showing logs after Docker container is run

`docker logs -f <instance_id_or_name>`
