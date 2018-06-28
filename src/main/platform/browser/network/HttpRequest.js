class HttpRequest {
    /**
     * @param {string} url
     * @param {number} [timeout]
     * @param {number} [maxResponseSize]
     * @returns {Promise.<string>}
     */
    static get(url, timeout = 5000, maxResponseSize = -1) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, /*async*/ true);
            xhr.responseType = 'text';
            xhr.timeout = timeout;
            xhr.onload = () => {
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                    resolve(xhr.responseText);
                } else {
                    reject(new Error(`Request failed (status ${xhr.status})`));
                }
            };
            xhr.onerror = reject;
            xhr.onabort = reject;
            xhr.ontimeout = reject;
            xhr.send();

            setTimeout(() => xhr.abort(), timeout);
        });
    }
}
Class.register(HttpRequest);
