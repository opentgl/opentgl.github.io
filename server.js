const fs = require('fs');
const http = require('http');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const env = {};
const envRaw = fs.readFileSync('.env', 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}

function toExportUrl(url) {
  const m = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!m) return url;
  const key = m[1];
  const gidMatch = url.match(/[#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${key}/export?format=csv&gid=${gid}`;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  if (filePath === './index.html') {
    let html = fs.readFileSync(filePath, 'utf8');
    const cfg = JSON.stringify({
      YANDEX_API_KEY: env.YANDEX_TILES_API || '',
      SHEET_URL: toExportUrl(env.GOOGLE_SHEET_TILES || '')
    });
    html = html.replace('/*CONFIG*/', cfg);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    }
  });
}

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? './index.html' : '.' + req.url;
  serveFile(res, url);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});
