import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],evidence=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
  await page.route('**/__p3-render__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;background:#231d18}canvas{display:block;width:1280px;height:720px}</style></head><body><canvas id="canvas"></canvas></body></html>'}));
  await page.goto('http://127.0.0.1:4175/__p3-render__');
  for(const map of ['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze']){
    evidence.push(await page.evaluate(async mapId=>{
      const [{StickerRenderer},{assets},{BattleEngine},{getMap}]=await Promise.all([
        import('/src/render/StickerRenderer.ts'),import('/src/render/AssetRegistry.ts'),import('/src/core/BattleEngine.ts'),import('/src/config/maps.ts')]);
      await assets.ready;
      const r=new StickerRenderer(document.querySelector('#canvas')),e=new BattleEngine({seed:91,autoWaves:false,mapId});e.start();
      const opens=e.state.grid.flatMap((row,y)=>row.flatMap((tile,x)=>tile==='O'?[{col:x,row:y}]:[]));
      ['kungfu_po','corgi','bamboo_mafia','squirrel','puss_in_hat','pepe_king'].forEach((kind,i)=>{
        const u=e.grant(kind);if(!e.move(u.unitId,{zone:'board',...opens[i]}).ok)throw Error('Fixture deploy failed');
      });
      ['shovel','panda','hat_bamboo','hamster','bee'].forEach(kind=>e.grant(kind));
      const path=getMap(mapId).paths.player;
      for(let i=1;i<path.length-2;i+=2){const m=e.spawnEnemy(i===9?'husky_wrecker':i%3===0?'roach':'rat','player');m.hp=m.maxHp=10000;m.progress=i;Object.assign(m,path[i]);}
      e.tick(.12);r.draw(e.state,e.state.time);
      window.__renderCheck={r,e};
      return{mapId,loaded:assets.has(`map_${mapId}`),enemies:e.state.enemies.length,events:e.state.events.map(v=>v.type)};
    },map));
    await page.screenshot({path:path.join(root,`verification/p3-render-${map}.png`)});
  }
  assert.ok(evidence.every(e=>e.loaded&&e.enemies>0&&e.events.includes('slash')));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({evidence,errors},null,2));
}finally{fs.writeFileSync(path.join(root,'verification/p3-render-report.json'),JSON.stringify({evidence,errors},null,2));await browser.close();}
