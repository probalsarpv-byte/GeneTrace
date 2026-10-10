// server.js - Real local HTTP server for GeneTrace
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root directory will be the parent of genetrace so /genetrace/ maps directly to genetrace
const SERVE_ROOT = path.resolve(__dirname, '../..');
const PORT = 8085;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json; charset=utf-8'
};

export function startServer(port = PORT) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let reqUrl = decodeURI(req.url.split('?')[0]);
            if (reqUrl === '/' || reqUrl === '/genetrace' || reqUrl === '/genetrace/') {
                reqUrl = '/genetrace/index.html';
            } else if (reqUrl === '/favicon.ico') {
                reqUrl = '/genetrace/assets/icon-192.svg';
            }

            const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
            const filePath = path.join(SERVE_ROOT, safePath);

            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end(`404 Not Found: ${reqUrl}`);
                    return;
                }

                const ext = path.extname(filePath).toLowerCase();
                const mime = MIME_TYPES[ext] || 'application/octet-stream';

                res.writeHead(200, {
                    'Content-Type': mime,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache'
                });

                const stream = fs.createReadStream(filePath);
                stream.pipe(res);
            });
        });

        server.listen(port, () => {
            console.log(`GeneTrace HTTP server running at http://localhost:${port}/genetrace/`);
            resolve(server);
        });
    });
}

if (process.argv[1] === __filename) {
    startServer();
}
