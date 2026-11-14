import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const runtime=path.join(root,'.runtime');
if(!fs.existsSync(path.join(dist,'index.html')))throw new Error('Run npm run build first.');
fs.mkdirSync(runtime,{recursive:true});
const token=crypto.randomBytes(24).toString('hex');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url??'/','http://127.0.0.1:4175');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(url.pathname==='/__capy_health__'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'capybara-defense',pid:process.pid}));return;
  }
  if(url.pathname==='/__capy_stop__'){
    if(req.method!=='POST'||req.headers['x-capy-token']!==token){res.writeHead(403);res.end();return;}
    res.end('Stopped');server.close(()=>process.exit(0));return;
  }
  let file;
  try{file=path.resolve(dist,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400);res.end();return;}
  if(file!==dist&&!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
  if(file===dist)file=path.join(dist,'index.html');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');
  res.setHeader('Cache-Control','no-cache');fs.createReadStream(file).pipe(res);
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(4175,'127.0.0.1',()=>{
  fs.writeFileSync(path.join(runtime,'server.json'),JSON.stringify({app:'capybara-defense',pid:process.pid,token}));
  console.log('Capybara: Chill Defense http://127.0.0.1:4175/');
});
