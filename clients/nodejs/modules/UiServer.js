const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

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
        const [filePath, fileSize, mimeType] = await this._determineFile(req);
        if (!filePath) {
            res.writeHead(404);
            res.end();
            return;
        }

        const fileStream = fs.createReadStream(filePath);
        fileStream.on('open', () => {
            if (fileSize) {
                res.setHeader('Content-Length', fileSize);
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
    }

    /**
     * @param req
     * @return {Promise.<Array.<string|number>>}
     */
    async _determineFile(req) {
        const uri = url.parse(req.url).pathname;
        let filePath;
        if (uri === '/web.js') {
            // special file that gets served from dist folder outside from ROOT folder
            filePath = path.join(UiServer.ROOT, '../../../dist/web.js');
        } else {
            filePath = path.join(UiServer.ROOT, uri); // creates a normalized path where stuff like /.. gets resolved
            if (!filePath.startsWith(UiServer.ROOT)) {
                // trying to access a file outside of ROOT
                return [null, null, null];
            }
        }

        let fileInfo = await this._getFileInfo(filePath);
        if (fileInfo && fileInfo.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
            fileInfo = await this._getFileInfo(filePath);
        }
        return [filePath, fileInfo? fileInfo.size : null, this._getMimeType(filePath)];
    }

    /**
     * @param {string} path
     * @returns {Promise.<fs.Stats>}
     */
    _getFileInfo(path) {
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
    _getMimeType(filePath) {
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
