const http = require('http');
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
                this._serveFile(req, res);
            } else {
                res.writeHead(405, 'Only GET requests allowed', {
                    Allow: 'GET'
                });
                res.end();
            }
        }).listen(config.port, '127.0.0.1');
    }

    async _serveFile(req, res) {
        const { path, size, mimeType } = await UiServer._resolveFile(req);
        if (!path) {
            res.writeHead(404);
            res.end();
            return;
        }

        const fileStream = fs.createReadStream(path);
        fileStream.on('open', () => {
            if (size) {
                res.setHeader('Content-Length', size);
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
     * @param req
     * @return {Promise.<{path: ?string, size: ?number, mimeType: ?string}>}
     */
    static async _resolveFile(req) {
        const uri = url.parse(req.url).pathname;

        // Take care of special files served from outside the ROOT folder.
        let filePath;
        switch (uri) {
            case '/web.js':
                filePath = path.join(UiServer.ROOT, '../../../dist/web.js');
                break;
            case '/mining-pools-mainnet.json':
                await NodeUtils.updatePoolList();
                filePath = path.join(UiServer.ROOT, '../modules/mining-pools-mainnet.json');
                break;
            default:
                filePath = path.join(UiServer.ROOT, uri); // creates a normalized path where stuff like /.. gets resolved
                if (!filePath.startsWith(UiServer.ROOT)) {
                    // trying to access a file outside of ROOT
                    return { path: null, size: null, mimeType: null };
                }
        }

        let fileInfo = await UiServer._getFileInfo(filePath);
        if (fileInfo && fileInfo.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
            fileInfo = await UiServer._getFileInfo(filePath);
        }

        return {
            path: filePath,
            size: fileInfo ? fileInfo.size : null,
            mimeType: UiServer._getMimeType(filePath)
        };
    }

    /**
     * @param {string} path
     * @returns {Promise.<fs.Stats>}
     */
    static _getFileInfo(path) {
        return new Promise((resolve) => {
            fs.stat(path, (err, stats) => {
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
     * @returns {string}
     */
    static _getMimeType(filePath) {
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml'
        };
        const extension = path.extname(filePath);
        return mimeTypes[extension];
    }
}
UiServer.ROOT = path.join(__dirname, '../node-ui');

module.exports = exports = UiServer;
