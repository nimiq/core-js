const url = require('url');
const childProcess = require('child_process');

class NodeUtils {
    static openBrowserTab(target, onError = null) {
        // Adapted from https://github.com/sindresorhus/opn
        if (typeof target !== 'string') {
            throw new Error('Expected an URL to open.');
        }
        const parsedUrl = url.parse(target);
        if ((parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') || !parsedUrl.hostname) {
            throw new Error('Not an absolute URL apparently');
        }

        let cmd;
        const args = [];
        const cpOpts = {};

        if (process.platform === 'darwin') {
            cmd = 'open';
        } else if (process.platform === 'win32') {
            cmd = 'cmd';
            args.push('/c', 'start', '""', '/b');
            target = target.replace(/&/g, '^&');
        } else {
            cmd = 'xdg-open';

            // `xdg-open` will block the process unless
            // stdio is ignored and it's detached from the parent
            // even if it's unref'd
            cpOpts.stdio = 'ignore';
            cpOpts.detached = true;
        }

        args.push(target);

        const cp = childProcess.spawn(cmd, args, cpOpts);

        if (onError) {
            cp.once('error', onError);
            cp.once('close', code => {
                if (code > 0) {
                    onError(`Exited with code ${code}`);
                }
            });
        }

        cp.unref();
        return cp;
    }
}

module.exports = NodeUtils;
