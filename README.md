# Nimiq Blockchain [![Build Status](https://travis-ci.com/nimiq-network/core.svg?token=euFrib9MJMN33MCBswws&branch=master)](https://travis-ci.com/nimiq-network/core) 

**[Nimiq](https://nimiq.com/)** is the first Browser-based Blockchain.

## Quickstart 

1. Clone this repository `git clone git@github.com:nimiq-network/core.git`.
2. Run `npm install`
3. Run `./node_modules/.bin/gulp build`
4. Open `clients/browser/index.html` in your browser to access the Browser Client.

## Web Developers
### Installation for Web Developers
Follow the Quickstart guide.

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
### Installation for Core Developers
- NodeJs latest version (> 7.9.0)
- gulp: `npm install gulp -g`
- jasmine test framework: `npm install jasmine -g`
- Dependencies: `npm install`
- NodeJs dependencies:

	```bash
	cd src/main/platform/nodejs/
	npm install
	cd clients/nodejs/
	npm install
	```

### Test and Build

#### Run Testsuite
- `gulp test` runs the testsuite in your browser.
- `jasmine` runs the testsuite in NodeJs.

#### Run ESLint
`gulp eslint` runs the ESLint javascript linter.

#### Build
Executing `gulp build` concatenates all sources into `dist/{web,web-babel,web-crypto,node}.js`

## Contribute

If you'd like to contribute to development Nimiq please follow our [Code of Conduct](/.github/CONDUCT.md) and [Contributing Guidelines](/.github/CONTRIBUTING.md).

## License

This project is under the [Apache License 2.0](./LICENSE)
