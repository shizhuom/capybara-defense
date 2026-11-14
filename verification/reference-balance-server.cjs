'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '../../..');
const runner = path.join(base, 'runner');
const root = path.join(base, 'analysis/recovered-game');
const port = 4174;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.ls':'application/json','.lh':'application/json','.atlas':'application/json','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8','.css':'text/css'};
const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const inside = (dir, name) => { const f = path.resolve(dir, name); return f.startsWith(dir + path.sep) ? f : null; };
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://127.0.0.1').pathname;
  if (req.method !== 'GET' || name.includes('..') || name.includes('\\')) { res.writeHead(403); return res.end(); }
  if (name === '/__runner/health') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({app:'reference-balance-read-only',pid:process.pid,port})); }
  let file;
  if (name === '/reference-balance-probe.js') file = path.join(__dirname, 'reference-balance-probe.js');
  else if (name === '/game/' || name === '/game/index.html') file = path.join(runner, 'test-mode/game.html');
  else if (name === '/game/js/bundle.js') file = path.join(runner, 'test-mode/bundle.js');
  else if (name.startsWith('/test-mode/')) file = inside(path.join(runner, 'test-mode'), name.slice(11));
  else if (name === '/game/compat.js') file = path.join(runner, 'compat.js');
  else if (name === '/game/libs/laya.webgl_2D.js') file = path.join(runner, 'vendor/laya-3.3.12/libs/laya.webgl_2D.js');
  else if (name.startsWith('/game/')) {
    const rel = name.slice(6), override = inside(path.join(runner, 'overrides'), rel);
    file = isFile(override) ? override : inside(root, rel);
  }
  if (file && !isFile(file) && /\.(ls|lh|atlas)\.json$/.test(file)) file = file.slice(0,-5);
  if (!file || !isFile(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  if (file.endsWith('game.html')) return res.end(fs.readFileSync(file,'utf8').replace('</body>','<script src="/reference-balance-probe.js"></script></body>'));
  if (name === '/game/js/bundle.js') return res.end(fs.readFileSync(file,'utf8').replace(';window.__offlineTest=', ';window.__referenceBalance={waves:_0x526be7,enemies:_0x37b3fd,draws:_0x17d2eb,actions:_0x2c6025,troops:_0x1568dd,buffs:_0x24d34a};window.__offlineTest='));
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('REFERENCE_BALANCE_SERVER_READY', process.pid, port));
