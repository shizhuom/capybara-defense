import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification'),temp=path.join(root,'.runtime/p12-browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const url='http://127.0.0.1:4175/',errors=[],checks=[],layouts=[],screenshots=[];let failure;
const shot=async(p,name)=>{await p.screenshot({path:path.join(out,`${name}.png`)});screenshots.push(name+'.png');};
async function act(p,id){await p.locator(`#game-dialog[open] [data-action="${id}"]`).filter({visible:true}).first().click();await p.waitForTimeout(80);}
async function ready(p,language){
 await p.goto(url,{waitUntil:'networkidle'});
 await p.evaluate(async lang=>{const{createProfile}=await import('/src/core/MetaProgression.ts');const a=createProfile();Object.assign(a,{stars:21,highestStars:21,selectedMap:'sunny_backyard',tutorialCompleted:true,tutorialRewardClaimed:true,coins:1500,freeLotteryTickets:2});a.settings.musicVolume=a.settings.soundVolume=0;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(a));localStorage.setItem('capybara_defense_v1:language',lang);},language);
 await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});
}
async function battle(p){
 await p.evaluate(()=>{window.__CAPY_DEBUG__.start();const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.state.sides.player.food=300;e.state.sides.player.oranges=3;e.state.sides.player.loot=['m01_swatter','m01_swatter','m10_bamboo_staff'];e.state.time=135;});
 await p.waitForTimeout(80);
}
async function result(p,won,oranges){
 await battle(p);
 await p.evaluate(({won,oranges})=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.oranges=oranges;e.state.phase='finished';e.state.result={winner:won?'player':'ai',reason:won?'waves':'oranges',loot:won?['m01_swatter','m01_swatter','m10_bamboo_staff']:[],playerLoot:['m01_swatter'],aiLoot:[],coins:won?103:0,elapsed:145,mvp:{kind:'kungfu_po',level:3,damage:12345,kills:48}};},{won,oranges});
 await p.locator('#game-dialog.result-ledger[open]').waitFor();await p.waitForTimeout(520);
}
async function layout(p,label){
 const r=await p.locator('#game-dialog').evaluate(d=>{
  const visible=e=>{const r=e.getBoundingClientRect();return !!(r.width&&r.height)&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden';};
  const bounds=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const selectors=['.crest-stage','.crest-return-btn','.btn-stats','.btn-continue','.crest-plaque-body','.crest-ribbon-title','.crest-stats-drawer','.pause-storybook-actions'];
  const boxes=selectors.flatMap(sel=>[...d.querySelectorAll(sel)].filter(visible).map(e=>({sel,...bounds(e)})));
  const overflow=[...d.querySelectorAll('.crest-plaque-body,.crest-ribbon-title,.crest-stats-drawer,.ledger-body,.pause-storybook-actions,.loot-tray li')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({cls:e.className,width:e.clientWidth,scroll:e.scrollWidth}));
  const thin=[...d.querySelectorAll('span,p,small,strong,b,button,h2,h3')].filter(visible).filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&Number(getComputedStyle(e).fontWeight)<700).map(e=>e.className);
  return{boxes,overflow,thin,broken:[...d.querySelectorAll('img')].filter(e=>e.complete&&!e.naturalWidth).map(e=>e.src),raw:/\bp12\.[\w.]+/.test(d.innerText),width:innerWidth,height:innerHeight};
 });layouts.push({label,...r});assert.deepEqual(r.overflow,[],label+' horizontal overflow');assert.deepEqual(r.thin,[],label+' bold text');assert.deepEqual(r.broken,[],label+' broken images');assert.equal(r.raw,false,label+' translation');
 for(const b of r.boxes)assert.ok(b.left>=-1&&b.right<=r.width+1&&b.top>=-1&&b.bottom<=r.height+1,label+' visible bounds '+b.sel);
}
try{
 for(const [name,width,height] of [['desktop',1366,768],['1080p',1920,1080],['mobile-landscape',844,390],['mobile-portrait',390,844]]){
  for(const language of ['zh-CN','en']){
   const context=await browser.newContext({viewport:{width,height}}),p=await context.newPage(),label=name+'-'+language;
   p.on('pageerror',e=>errors.push(label+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(label+': '+m.text());});
   await ready(p,language);await battle(p);await p.locator('#battle-hud [data-action="pause"]').click();await p.waitForTimeout(150);
   await layout(p,label+' pause');await shot(p,`p12-${label}-pause`);
   const frozen=await p.locator('#battle-canvas').evaluate(c=>c.toDataURL());await p.waitForTimeout(250);assert.equal(await p.locator('#battle-canvas').evaluate(c=>c.toDataURL()),frozen,label+' paused canvas frozen');
   await act(p,'profile');assert.ok(await p.locator('.profile-dialog').count());await act(p,'close-profile');assert.ok(await p.locator('.pause-ledger').count());await act(p,'resume');
   await result(p,true,3);await layout(p,label+' victory');assert.equal(await p.locator('.crest-stars-arc [data-sticker="ui_victory_star_lit"]').count(),3);assert.equal(await p.locator('.crest-stats-drawer').isVisible(),false);await shot(p,`p12-${label}-victory`);
   await act(p,'toggle-result-stats');assert.equal(await p.locator('.crest-stats-drawer').isVisible(),true);await layout(p,label+' stats');await shot(p,`p12-${label}-stats`);
   assert.ok((await p.locator('.result-mvp-card').innerText()).includes('12345'));await p.keyboard.press('Escape');assert.equal(await p.locator('.crest-stats-drawer').isVisible(),false);assert.equal(await p.locator('.btn-stats').evaluate(e=>e===document.activeElement),true);
   await act(p,'menu');await result(p,false,0);await layout(p,label+' defeat');assert.equal(await p.locator('.crest-stars-arc [data-sticker="ui_victory_star_dim"]').count(),3);await shot(p,`p12-${label}-defeat`);
   await act(p,'start');await p.waitForTimeout(1400);assert.equal(await p.locator('#game-dialog').isVisible(),false);assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.phase),'playing');
   checks.push(label+': pause/resume/profile return, 3-star victory, stats/Escape focus, defeat/retry, image and geometry checks');await context.close();
  }
 }
 const context=await browser.newContext({viewport:{width:1366,height:768}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await ready(p,'zh-CN');await battle(p);
 await p.evaluate(()=>{
  const e=window.__CAPY_DEBUG__.engine;const kinds=['rat','charmed_rat','roach','crab','killer_bee','hornet_queen','mega_roomba','dr_clippers','sad_rain_frog','buff_roo','husky_wrecker','box_kraken','diva_kitty','screaming_marmot','king_skunk','trash_coon','dj_rat_king'];
  e.state.sides.player.oranges=3;for(let i=0;i<kinds.length;i++){const n=e.spawnEnemy(kinds[i],'player');Object.assign(n,{progress:.5+i*1.05,speed:.12,hp:100000,maxHp:100000,abilityCooldown:100});}
  // Keep this diagnostic scene unobscured so every locomotion family is visible.
  e.state.sides.player.fog=0;
  for(const [i,kind]of ['hamster','squirrel','hedgehog','corgi','kungfu_po','puss_in_hat','bamboo_mafia','zen_master'].entries()){e.grant(kind);const u=e.state.units.at(-1);u.location={zone:'board',col:1+i%7,row:1+i%2};}
 });
 await p.waitForTimeout(2600);for(let i=0;i<4;i++){await shot(p,`p12-continuous-combat-${i}`);await p.waitForTimeout(83);}
 await p.locator('#battle-hud [data-action="pause"]').click();await p.waitForTimeout(120);const frozen=await p.locator('#battle-canvas').evaluate(c=>c.toDataURL());await p.waitForTimeout(300);assert.equal(await p.locator('#battle-canvas').evaluate(c=>c.toDataURL()),frozen);checks.push('crowded combat: all seven locomotion rigs; whole canvas freezes during pause');
 const benchmark=await p.evaluate(async()=>{
  const{BattleEngine}=await import('/src/core/BattleEngine.ts'),{StickerRenderer}=await import('/src/render/StickerRenderer.ts'),{getMap}=await import('/src/config/maps.ts');
  const e=new BattleEngine({autoWaves:false});e.start();const c=document.createElement('canvas'),r=new StickerRenderer(c),timings=[];const kinds=['rat','roach','crab','killer_bee','husky_wrecker','mega_roomba','sad_rain_frog'];
  for(let i=0;i<28;i++){const n=e.spawnEnemy(kinds[i%7],'player');n.progress=(i*.6)%19;}
  for(let i=0;i<12;i++){e.grant(i%2?'hamster':'kungfu_po');e.state.units.at(-1).location={zone:'board',col:1+i%7,row:1+i%3};}
  const route=getMap(e.state.mapId).paths.player;
  for(let i=0;i<240;i++){
   for(const n of e.state.enemies){n.progress=(n.progress+.003)%19;const k=Math.floor(n.progress),f=n.progress-k;n.col=route[k].col+(route[k+1].col-route[k].col)*f;n.row=route[k].row+(route[k+1].row-route[k].row)*f;}
   const start=performance.now();r.draw(e.state,i/60);const cost=performance.now()-start;if(i>=30)timings.push(cost);
   if(i%30===0)await new Promise(requestAnimationFrame);
  }
  timings.sort((a,b)=>a-b);return{units:e.state.units.length,enemies:e.state.enemies.length,samples:timings.length,medianMs:timings[Math.floor(timings.length*.5)],p95Ms:timings[Math.floor(timings.length*.95)],maxMs:timings.at(-1),budgetMs:1000/60};
 });checks.push({benchmark});await context.close();assert.deepEqual(errors,[]);
}catch(error){failure=error;console.error(error.stack??error);}
finally{await browser.close();fs.writeFileSync(path.join(out,'p12-browser-report.json'),JSON.stringify({passed:!failure,checks,layouts,screenshots,errors,failure:failure?.message},null,2));console.log(JSON.stringify({passed:!failure,screenshots:screenshots.length,layouts:layouts.length,errors:errors.length}));}
if(failure)process.exitCode=1;
