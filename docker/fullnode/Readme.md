# Full node Dockerfile

This ![Dockerfile]('./Dockerfile') builds a full node, the pre-requesites for setting up a full node are:

* SSL certs are required - see [Lets Encrypt](https://letsencrypt.org/) to generate full certificates
* A domain name and server that is publicly reachable

### Dockerfile build parameters

The Dockerfile needs to be built with a list of parameters which much be specified in order to properly run

| Argument | Description | Is it Mandatory | Default Value
| --- | --- | --- | --- |
| PRIVATE_KEY_PATH  | Local path to your private key .pem file, this will be copied over into the Docker container  | Yes | |
| CERT_PATH  | Local path to your certificate full chain key .pem file, this will be copied over into the Docker container  | Yes | |
| WALLET_ADDRESS  | The wallet address you want NIM to mine to | Yes | |
| HOST  | The hostname of your server | Yes | |
| THREADS  | Number of threads/cores you want to run the Node.js miner with | No | 4 |
| NETWORK  | The blockchain network to mine on (e.g. can be main, dev, test) | No | main |
| EXTRA_DATA  | Extra data to pass within the hash - if you are running multiple miners to the same WALLET_ADDRESS then you should set this to a unique value, otherwise ignore this value | No | |
| PORT  | Port to expose your miner node to | No | 80 |
| STATISTICS  | The interval (seconds) to console log the Node.js output at | No | 60 |

You can build the Docker image by running the following example command:

```
docker build \
  --build-arg PRIVATE_KEY_PATH=./privkey.pem \
  --build-arg CERT_PATH=./fullchain.pem \
  --build-arg WALLET_ADDRESS=NQ14U61PLSPY13KM9MNCLRMAUKX313A70EFM \
  --build-arg HOST=my.nimiq.host.com \
  --build-arg THREADS=2 \
  --build-arg STASTICS=10 \
  -t nimiq .
```

### Running the docker image

Once the Docker image builds successfully, you can then run the Docker a container via the previously built image:

```
docker run -p 9001:80 -it nimiq
```

The -p argument specifies the host-port:container-port mapping (e.g. host-port, in this example 9001 is a  port on the host machine that is publicly available and non-firewalled, and the container-port is the port you've specified in the BUILD argument in the previous step's `docker build` command which defaults to port 80)


### Troubleshooting docker failures


#### Showing logs after Docker container is run

`docker logs -f <instance_id_or_name>`
