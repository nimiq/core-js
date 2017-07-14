# Nimiq Blockchain [![Build Status](https://travis-ci.org/nimiq-network/core.svg)](https://travis-ci.org/nimiq-network/core)

**[Nimiq](https://nimiq.com/)** is a frictionless payment protocol for the web.

For a high-level introduction checkout the [Nimiq White Paper](https://medium.com/nimiq-network/nimiq-a-peer-to-peer-payment-protocol-native-to-the-web-ffd324bb084).

## Library Demo
Check out our betanet [Browser Miner](https://nimiq.com/betanet).

## Quickstart

1. Clone this repository `git clone https://github.com/nimiq-network/core`.
2. Run `npm install` or `yarn`
3. Run `npm run build` or `yarn build`
4. Open `clients/browser/index.html` in your browser to access the Browser Client.

## Web Developers
### Most simple Web Application on top of the Nimiq Blockchain
A good way to get started is to have a look at [the most simple web application on top of the Nimiq Blockchain](https://robinlinus.github.io/nimiq-demo/).

### Installation for Web Developers
Follow the Quickstart guide or use our CDN:

```
<script src="https://cdn.nimiq.com/core/nimiq.js"></script>
```


### Run Client

#### Run Browser Client
Open `clients/browser/index.html` in your browser.

#### Run NodeJs client

To run a NodeJs Client you will need a **publicly routable IP**, **Domain** and **SSL Certificate** (get a free one at [letsencrypt.org](https://letsencrypt.org/)). Start the client by running `clients/nodejs/index.js`.

```bash
cd clients/nodejs/
node index.js --host <hostname> --port <port> --key <privkey> --cert <certificate>
```

| Argument        | Description           |
| ------------- |:-------------:|
| **_host_** | Hostname of the NodeJs client. |
| **_port_** | Port used to communicate with the peers. |  
| **_key_** | Private key for the client      |
| **_cert_** | SSL certificate of your Domain.       |
| **_wallet-seed_** | Your wallet seed (optional)        |


### Build your own Browser client
Just include `<script src="dist/nimiq.js"></script>` in your project.

### API
Visit the [API Documentation](dist/API_DOCUMENTATION.md).


## Core Developers
Developers are free to choose between npm and yarn for managing the dependencies.
### Installation for Core Developers (using npm)
- NodeJs latest version (> 7.9.0)
- Dependencies: `npm install`
- NodeJs dependencies:

	```bash
	cd src/main/platform/nodejs/
	npm install
	cd clients/nodejs/
	npm install
	```

### Installation for Core Developers (using yarn)
- NodeJs latest version (> 7.9.0)
- Dependencies: `yarn`
- NodeJs dependencies:

	```bash
	cd src/main/platform/nodejs/
	yarn
	cd clients/nodejs/
	yarn
	```

### Test and Build

#### Run Testsuite
- `npm test` or `yarn test` runs browser and NodeJS tests.
- `npm run test-browser` or `yarn test-browser` runs the testsuite in your browser only.
- `npm run test-node` or `yarn test-node` runs the testsuite in NodeJS only.

#### Run ESLint
`npm run lint` or `yarn lint` runs the ESLint javascript linter.

#### Build
Executing `npm run build` or `yarn build` concatenates all sources into `dist/{web,web-babel,web-crypto,node}.js`

## Docker

A Dockerfile is provided which allows for creating your own backbone image using the following arguments.

| Argument  | Description |
| ------------- | ------------- |
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

If you'd like to contribute to development Nimiq please follow our [Code of Conduct](/.github/CONDUCT.md) and [Contributing Guidelines](/.github/CONTRIBUTING.md).

## License

This project is under the [Apache License 2.0](./LICENSE.md).
