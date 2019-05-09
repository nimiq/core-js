# Nimiq Blockchain [![Build Status](https://travis-ci.org/nimiq/core-js.svg?branch=master)](https://travis-ci.org/nimiq/core-js)

**[Nimiq](https://nimiq.com/)** is a frictionless payment protocol for the web.

## Resources

- [Nimiq White Paper](https://medium.com/nimiq-network/nimiq-a-peer-to-peer-payment-protocol-native-to-the-web-ffd324bb084): High-level introduction of the Nimiq payment protocol.
- [Nimiq Developer Reference](https://nimiq-network.github.io/developer-reference/): Details of the protocol architecture.
- [Core API Documentation](https://doc.esdoc.org/github.com/nimiq/core-js/): Documentation of the Nimiq Core library API.
- [Node.js Client Documentation](doc/nodejs-client.md): Usage and configuration documentation for the Nimiq Node.js Client.
- [JSON-RPC Client Documentation](doc/json-rpc-client.md): Usage instructions for the Nimiq JSON-RPC Client.
- [Docker Documentation](doc/docker.md): Instructions on setting up a Nimiq Node using Docker.
- [Packaging Documentation](doc/linux-packaging.md): Instructions on how to build binary packages for Linux (.deb and/or RPM) from this source code.

## Demo
Check out our [Testnet](https://nimiq-testnet.com).

## Packages
### Prebuilt binary packages
For users looking to run a standalone Nimiq node (which is also capable of mining), see our [Downloads page](https://nimiq.com/#downloads) for installable Linux and Windows binary packages.

### NPM Packages
For developers looking to include Nimiq support on their applications, there are two npm packages available:

- [`@nimiq/core`](https://www.npmjs.com/package/@nimiq/core): Module for use in node.js applications.
- [`@nimiq/core-web`](https://www.npmjs.com/package/@nimiq/core-web): Module for use in client-side (browser) applications (includes the same files that are available from [our CDN](#getting-started)).

## Quickstart

1. Install [Node.js](https://nodejs.org) v8.0.0 or higher.
2. On Ubuntu and Debian, install `git` and `build-essential`: `sudo apt-get install -y git build-essential`.
    - On other Linux systems, install `git`, `python2.7`, `make`, `gcc` and `gcc-c++`.
    - For MacOS or Windows, [check here for git](https://git-scm.com/downloads) and [here for compilation tools](https://github.com/nodejs/node-gyp#on-mac-os-x).
3. Install `yarn` globally: `sudo npm install -g yarn`.
4. Install `gulp` globally:  `yarn global add gulp`.
5. Clone this repository: `git clone https://github.com/nimiq/core-js`.
6. Build the project: `cd core && yarn && yarn build`.
7. Open `clients/browser/index.html` in your browser.

## Web Developers
### Simple Web Application on top of Nimiq
A good way to get started is to have a look at [the most simple web application on top of the Nimiq Blockchain](https://demo.nimiq.com/).

### Getting Started
Follow the [Quickstart](#quickstart) guide or make use of our CDN:

```
<script src="https://cdn.nimiq.com/nimiq.js"></script>
```

## Browser client

Open `clients/browser/index.html` in your browser or include `<script src="dist/nimiq.js"></script>` in your project.

## Node.js client

To run a Node.js client you will need a **publicly routable IP**, **Domain**, and **SSL Certificate** (get a free certificate at [letsencrypt.org](https://letsencrypt.org/)). Start the client by running `clients/nodejs/nimiq` with the respective [configuration](doc/nodejs-client.md).

## Test and Build

### Run Testsuite
- `yarn test` runs browser and Node.js tests.
- `yarn test-browser` runs the testsuite in your browser only.
- `yarn test-node` runs the testsuite in Node.js only.

### Run ESLint
`yarn lint` runs the ESLint javascript linter.

### Build
Executing `yarn build` concatenates all sources into `dist/{web,web-babel,web-crypto,node}.js`

## Contribute

If you'd like to contribute to the development of Nimiq please follow our [Code of Conduct](/.github/CODE_OF_CONDUCT.md) and [Contributing Guidelines](/.github/CONTRIBUTING.md).

## License

This project is under the [Apache License 2.0](./LICENSE.md).
