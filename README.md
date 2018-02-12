# Nimiq Blockchain [![Build Status](https://travis-ci.org/nimiq-network/core.svg)](https://travis-ci.org/nimiq-network/core)

**[Nimiq](https://nimiq.com/)** is a frictionless payment protocol for the web.

For a high-level introduction check out the [Nimiq White Paper](https://medium.com/nimiq-network/nimiq-a-peer-to-peer-payment-protocol-native-to-the-web-ffd324bb084).

To dive into the details of the protocol architecture check out the [Nimiq Developer Reference](https://nimiq.com/developer-reference).

## Library Demo
Check out our testnet [Browser Miner](https://nimiq.com/miner) and [Wallet](https://nimiq.com/wallet).

## Quickstart

1. Install [Node.js](https://nodejs.org) v8.0.0 or higher.
2. On Ubuntu, install `git` and `build-essential`: `sudo apt-get install -y git build-essential`.
    - On other Linux systems, install `git`, `python2.7`, `make` and `gcc`.
    - For MacOS or Windows, [check here for git](https://git-scm.com/downloads) and [here for compilation tools](https://github.com/nodejs/node-gyp#on-mac-os-x).
3. If you want to use `yarn` to manage the dependencies, run: `sudo npm install -g yarn`.
4. Install `gulp` globally: `sudo npm install -g gulp` or `yarn global add gulp`.
5. Clone this repository: `git clone https://github.com/nimiq-network/core`.
6. Enter the core directory: `cd core`.
7. Run: `npm install` or `yarn`.
8. Run: `npm run build` or `yarn build`.
9. Open `clients/browser/index.html` in your browser.

## Web Developers
### Most simple Web Application on top of the Nimiq Blockchain
A good way to get started is to have a look at [the most simple web application on top of the Nimiq Blockchain](https://demo.nimiq.com/).

### Installation for Web Developers
Follow the Quickstart guide or use our CDN:

```
<script src="https://cdn.nimiq.com/core/nimiq.js"></script>
```


### Run browser client
Open `clients/browser/index.html` in your browser.

### Run Node.js client
To run a Node.js client you will need a **publicly routable IP**, **Domain** and **SSL Certificate** (get a free one at [letsencrypt.org](https://letsencrypt.org/)). Start the client by running `clients/nodejs/index.js`.

```bash
cd clients/nodejs/
node index.js --host=HOSTNAME --port=PORT --cert=SSL_CERT_FILE --key=SSL_KEY_FILE [options]
```

| **Configuration** | |
| :--- | :--- |
| `--host=HOSTNAME` | Hostname of the Node.js client. |
| `--port=PORT` | Port to listen on for connections. |
| `--cert=SSL_CERT_FILE` | SSL certificate file for your domain. CN should match HOSTNAME. |
| `--key=SSL_KEY_FILE` | SSL private key file for your domain. |
| **Options** | |
| `--help` | Show usage instructions. |
| `--log[=LEVEL]` | Configure global log level. |
| `--log-tag=TAG[:LEVEL]` | Configure log level for a specific tag. |
| `--miner[=THREADS]` | Activate mining on this node with THREADS parallel threads. |
| `--passive` | Do not actively connect to the network. |
| `--rpc[=PORT]` | Start JSON-RPC server on port PORT (default: 8648). |
| `--statistics[=INTERVAL]` | Output miner statistics every INTERVAL seconds. |
| `--type=TYPE` | Configure the consensus type, one of full (default), light or nano. |
| `--wallet-seed=SEED` | Initialize wallet using SEED as a wallet seed. |
| `--wallet-address=ADDRESS` | Initialize wallet using ADDRESS as a wallet address. |

### Build your own browser client
Just include `<script src="dist/nimiq.js"></script>` in your project.

### API
Visit the [API Documentation](dist/API_DOCUMENTATION.md).


## Core Developers
Developers are free to choose between `npm` and `yarn` for managing the dependencies.
### Installation for Core Developers (using npm)
- Node.js latest version (> 8.0.0)
- Dependencies: `npm install`
- Node.js dependencies:

	```bash
	cd src/main/platform/nodejs/
	npm install
	cd clients/nodejs/
	npm install
	```

### Installation for Core Developers (using yarn)
- Node.js latest version (> 8.0.0)
- Dependencies: `yarn`
- Node.js dependencies:

	```bash
	cd src/main/platform/nodejs/
	yarn
	cd clients/nodejs/
	yarn
	```

### Test and Build

#### Run Testsuite
- `npm test` or `yarn test` runs browser and Node.js tests.
- `npm run test-browser` or `yarn test-browser` runs the testsuite in your browser only.
- `npm run test-node` or `yarn test-node` runs the testsuite in Node.js only.

#### Run ESLint
`npm run lint` or `yarn lint` runs the ESLint javascript linter.

#### Build
Executing `npm run build` or `yarn build` concatenates all sources into `dist/{web,web-babel,web-crypto,node}.js`

## Docker

A Dockerfile is provided which allows for creating your own backbone image using the following arguments.

| Argument | Description |
| --- | --- |
| BRANCH  | Defaults to *master* but can be any available git branch  |
| PORT  | Defaults to TCP port *8080* |
| DOMAIN  | Domain to be used for hosting the backbone node  |
| KEY  | Path to an existing certificate key for the DOMAIN  |
| CRT  | Path to an existing signed certificate for the DOMAIN  |
| WALLET_SEED  | Pre-existing wallet private key  |

### Building the Docker image using the above arguments
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

### Running an instance of the image

`docker run -d -p 8080:8080 -v /etc/letsencrypt/:/etc/letsencrypt/ --name "nimiq" nimiq`

Note that you can override any of the arguments which were baked into the image at runtime with exception to the *BRANCH*. The -v flag here allows for mapping a local system path into the container for the purpose of using the existing *DOMAIN* certificates.

### Check status
`docker logs -f <instance_id_or_name>`

## Contribute

If you'd like to contribute to the development of Nimiq please follow our [Code of Conduct](/.github/CODE_OF_CONDUCT.md) and [Contributing Guidelines](/.github/CONTRIBUTING.md).

## License

This project is under the [Apache License 2.0](./LICENSE.md).
