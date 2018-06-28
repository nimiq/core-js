const URL = require('url');

class HttpRequest {
    /**
     * @param {string} url
     * @param {number} [timeout]
     * @param {number} [maxResponseSize]
     * @returns {Promise.<string>}
     */
    static get(url, timeout = 5000, maxResponseSize = -1) {
        const parsedUrl = URL.parse(url);
        const protocol = parsedUrl.protocol === 'http:' ? http : https;
        return new Promise((resolve, reject) => {
            const req = protocol.get(parsedUrl, res => {
                if (res.statusCode !== 200) {
                    res.resume(); // Consume response data to free up memory.
                    reject(new Error(`Request failed (status ${res.statusCode})`));
                    return;
                }

                let data = '';
                res.on('data', chunk => {
                    data += chunk;

                    // Abort if maxResponseSize is exceeded.
                    if (maxResponseSize > 0 && data.length > maxResponseSize) {
                        res.resume(); // Consume response data to free up memory.
                        reject(new Error(`Max response size ${maxResponseSize} exceeded`));
                        req.abort();
                    }
                });
                res.on('end', () => resolve(data));
                res.on('error', e => {
                    res.resume(); // Consume response data to free up memory.
                    reject(e);
                });
            });

            req.on('error', reject);
            req.on('abort', () => reject(new Error('Request timed out')));
            req.on('timeout', () => req.abort());
            req.setTimeout(timeout);

            setTimeout(() => req.abort(), timeout);
        });
    }
}
Class.register(HttpRequest);
