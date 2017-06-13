# Nimiq Blockchain [![Build Status](https://travis-ci.com/nimiq-network/core.svg?token=euFrib9MJMN33MCBswws&branch=master)](https://travis-ci.com/nimiq-network/core)

**[Nimiq](https://nimiq.com/)** is the first Browser-based Blockchain.

## Library Demo
Check out our betanet [Browser Miner](https://nimiq.com/betanet)

## Quickstart

1. Clone this repository `git clone https://github.com/nimiq-network/core`.
2. Run `npm install` or `yarn`
3. Run `npm run build` or `yarn build`
4. Open `clients/browser/index.html` in your browser to access the Browser Client.

## Web Developers
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

## Contribute

If you'd like to contribute to development Nimiq please follow our [Code of Conduct](/.github/CONDUCT.md) and [Contributing Guidelines](/.github/CONTRIBUTING.md).

## License

This project is under the [Apache License 2.0](./LICENSE)
