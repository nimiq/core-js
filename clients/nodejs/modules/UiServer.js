const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const NodeUtils = require('./NodeUtils.js');

class UiServer {
    /**
     * @param {{port: number}} config
     */
    constructor(config) {
        http.createServer((req, res) => {
            if (req.method === 'GET') {
                UiServer._serveFile(req, res);
            } else {
                res.writeHead(405, 'Only GET requests allowed', {
                    Allow: 'GET'
                });
                res.end();
            }
        }).listen(config.port, '127.0.0.1');
    }

    /**
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse} res
     * @returns {Promise.<void>}
     */
    static async _serveFile(req, res) {
        const filePath = await UiServer._resolveFile(req);
        if (!filePath) {
            res.writeHead(404);
            res.end();
            return;
        }
        if (UiServer._isRemoteFile(filePath)) {
            UiServer._proxyRemoteFile(filePath, res);
        } else {
            await UiServer._serveLocalFile(filePath, res);
        }
    }

    /**
     * @param {http.IncomingMessage} req
     * @returns {Promise.<string|null>}
     */
    static async _resolveFile(req) {
        const uri = url.parse(req.url).pathname;

        // Take care of special files served from outside the ROOT folder.
        if (uri === '/web.js') {
            return path.join(UiServer.ROOT, '../../../dist/web.js');
        }
        if (uri === '/mining-pools-mainnet.json') {
            return 'https://miner.nimiq.com/mining-pools-mainnet.json';
        }

        let filePath = path.join(UiServer.ROOT, uri); // creates a normalized path where stuff like /.. gets resolved
        if (!filePath.startsWith(UiServer.ROOT)) {
            // trying to access a file outside of ROOT
            return null;
        }
        const fileInfo = await UiServer._getFileInfo(filePath);
        if (fileInfo && fileInfo.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
        return filePath;
    }

    /**
     * @param {string} filePath
     * @returns {boolean}
     * @private
     */
    static _isRemoteFile(filePath) {
        const uri = url.parse(filePath);
        return (uri.protocol === 'http:' || uri.protocol === 'https:') && !!uri.hostname;
    }

    /**
     * @param {string} filePath
     * @param {http.ServerResponse} res
     * @returns {Promise.<void>}
     */
    static async _serveLocalFile(filePath, res) {
        const mimeType = UiServer._getMimeType(filePath);
        const fileInfo = await UiServer._getFileInfo(filePath);

        const fileStream = fs.createReadStream(filePath);
        fileStream.on('open', () => {
            if (fileInfo) {
                res.setHeader('Content-Length', fileInfo.size);
            }
            if (mimeType) {
                res.setHeader('Content-Type', mimeType);
            }
            res.writeHead(200);
            fileStream.pipe(res); // sends the data and ends the request
        });
        fileStream.on('error', err => {
            err = err.message || err;
            if (typeof err === 'string' && err.indexOf('ENOENT') !== -1) {
                res.writeHead(404);
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.write(`${err}\n`);
            }
            res.end();
        });
        fileStream.on('finish', () => fileStream.close());
    }

    /**
     * @param {string} filePath
     * @param {http.ServerResponse} res
     */
    static _proxyRemoteFile(filePath, res) {
        const mimeType = UiServer._getMimeType(filePath);

        const client = url.parse(filePath).protocol === 'https:'? https : http;
        client.get(filePath, response => {
            if (response.statusCode !== 200) {
                response.resume();
                res.writeHead(404);
                res.end();
                return;
            }

            const contentLength = response.headers['content-length'];
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }
            if (mimeType) {
                res.setHeader('Content-Type', mimeType);
            }
            response.pipe(res);
        }).on('error', () => {
            res.writeHead(404);
            res.end();
        });
    }

    /**
     * @param {string} filePath
     * @returns {Promise.<fs.Stats>}
     */
    static _getFileInfo(filePath) {
        return new Promise((resolve) => {
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    resolve(null);
                    return;
                }
                resolve(stats);
            });
        });
    }

    /**
     * @param {string} filePath
     * @returns {string|undefined}
     */
    static _getMimeType(filePath) {
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
            '.json': 'application/json'
        };
        const extension = path.extname(filePath);
        return mimeTypes[extension];
    }
}
UiServer.ROOT = path.join(__dirname, '../node-ui');

module.exports = exports = UiServer;
