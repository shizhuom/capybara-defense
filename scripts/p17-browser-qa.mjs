// P17 Endless Awakening visual QA (dev server; set P17_DEV_URL, default http://127.0.0.1:4176/).
//   node scripts/p17-browser-qa.mjs [desktop|mobile-landscape|mobile-portrait]
// Phase A runs without a leaderboard (local mode). Phase B mocks a Worker at https://board.qa through page.route.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/p17-browser-tmp');
fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(out,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const URL_=process.env.P17_DEV_URL??'http://127.0.0.1:4176/',only=process.argv[2];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],layouts=[],shots=[];let failure;
const shot=async(p,name)=>{await p.screenshot({path:path.join(out,name+'.png')});shots.push(name+'.png');};
const MEDALS={med_breakthrough_atk:25,med_luck_rate:12,med_momentum:40,med_boss_resist:50,med_boss_slayer:3,med_capy_shield:25};
async function ready(p,patch={}){
 await p.goto(URL_,{waitUntil:'networkidle'});
 await p.evaluate(async({patch,MEDALS})=>{
  const {createProfile,unlockAllProfile}=await import('/src/core/MetaProgression.ts');
  const profile=Object.assign(unlockAllProfile(createProfile()),{stars:60,highestStars:60,selectedMap:'sunny_backyard',tutorialCompleted:true,tutorialRewardClaimed:true,earlyWaveTipSeen:true,
   coins:4200,endlessCrests:1260,endlessMedallions:MEDALS,activeBrothId:'dish_yuzu_bath',bestEndlessWave:37,bestEndlessTime:2100,bestEndlessMvp:'kungfu_po',bestEndlessAwakened:1,playerId:'capy_qaplayer00001',nickname:''},patch);
  profile.settings.musicVolume=profile.settings.soundVolume=0;
  localStorage.clear();localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.setItem('capybara_defense_v1:language','zh-CN');
 },{patch,MEDALS});
 await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});await p.waitForTimeout(250);
}
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
const rect=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};},sel);
const overlaps=(a,b)=>a&&b&&a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
async function action(p,id){await p.locator(`#game-dialog[open] [data-action="${id}"]`).filter({visible:true}).first().click();await p.waitForTimeout(140);}
async function ledgerLayout(p,label){
 const report=await p.evaluate(()=>{
  const dialog=document.querySelector('#game-dialog[open]'),r=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom};};
  const overflow=[...dialog.querySelectorAll(':is(.ledger-body,.medallion-row,.endless-board-card,.endless-board-row,.storybook-footer-tip,.ledger-header)')].filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+2).map(e=>String(e.className));
  return{overflow,dialog:r(dialog),viewport:{w:innerWidth,h:innerHeight},broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),raw:/\b(?:p17|medallion|p11\.tab)\.[\w.-]+/.test(dialog.innerText)};
 });
 layouts.push({label,...report});
 assert.deepEqual(report.overflow,[],label+' overflow');assert.deepEqual(report.broken,[],label+' broken image');assert.equal(report.raw,false,label+' raw key');
 assert.ok(report.dialog.x>=-1&&report.dialog.right<=report.viewport.w+1,label+' dialog fits');
}
async function startLayout(p,name){
 const items=await p.evaluate(()=>[...document.querySelectorAll('#menu-screen :is(.hub-dock button,.start-button,.map-chips,.profile-pill,.menu-system,.active-broth-pill,.endless-hall-pill)')].map(b=>{const r=b.getBoundingClientRect();return{a:b.dataset.action??b.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 const docks=await p.evaluate(()=>['left','right'].map(side=>[...document.querySelectorAll(`#menu-screen .hub-dock-${side} button`)].map(b=>b.dataset.action)));
 assert.deepEqual(docks,[['recipes','armory','kitchen'],['village','market','leaderboard']],name+' 3 + 3 docks');
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)assert.equal(overlaps(items[i],items[j]),false,`${name} ${items[i].a} / ${items[j].a} overlap`);
 const pill=items.find(i=>i.a==='medallions'),vp=await p.evaluate(()=>({w:innerWidth,h:innerHeight}));
 assert.ok(pill&&pill.x>=0&&pill.right<=vp.w&&pill.bottom<=vp.h,name+' pill visible');
 layouts.push({label:name+' start',items});
}
/** Stage (1280×720) → viewport pixels on the battle canvas. */
async function stagePoint(p,unitId){
 return p.evaluate(async id=>{
  const {STAGE}=await import('/src/config/maps.ts'),e=window.__CAPY_DEBUG__.engine,u=e.state.units.find(x=>x.id===id),c=document.getElementById('battle-canvas').getBoundingClientRect();
  const x=u.location.zone==='board'?STAGE.boardX+(u.location.col+.5)*STAGE.cell:STAGE.benchX+u.location.slot*STAGE.benchStep+STAGE.benchSize/2;
  const y=u.location.zone==='board'?STAGE.boardY+(u.location.row+.5)*STAGE.cell:STAGE.benchY+STAGE.benchSize/2;
  return{x:c.x+x/STAGE.width*c.width,y:c.y+y/STAGE.height*c.height};
 },unitId);
}
const select=async(p,id)=>{const pt=await stagePoint(p,id);await p.mouse.click(pt.x,pt.y);await p.waitForTimeout(220);};
/** In-page mock of the Cloudflare Worker (CORS included), so the online board and global rank render for real. */
async function mockBoard(p){
 const others=Array.from({length:22},(_,i)=>({rank:i+1,playerId:`capy_other${String(i).padStart(7,'0')}`,nickname:['抹茶团子','柚子汽水','温泉猫猫','竹林大侠','橘子守护者','咕噜咕噜'][i%6]+(i+1),avatarId:['capybara','kungfu_panda','frog_king','cat_swordsman','sakura_capy','zen_capy'][i%6],
  bestWave:78-i*2,elapsedSeconds:3600+i*95,mvpKind:['kungfu_po','pepe_king','rocket_coon','meowfia','zen_master','doge_wick'][i%6],mvpAwakened:i%3===0,awakenedCount:Math.max(0,4-(i>>2)),medallionTotal:300-i*9,updatedAt:1}));
 let me=null;
 await p.addInitScript(()=>{window.CAPY_LEADERBOARD_API_URL='https://board.qa';});
 await p.route('https://board.qa/**',async route=>{
  const req=route.request(),cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(req.method()==='POST'){const body=JSON.parse(req.postData()||'{}');me={...body,rank:7,updatedAt:2};return route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({ok:true,rank:7,totalPlayers:others.length+1,bestWave:body.bestWave,improved:true})});}
  const entries=[...others.slice(0,6),...(me?[me]:[]),...others.slice(6)].map((e,i)=>({...e,rank:i+1}));
  const mine=entries.find(e=>e.playerId==='capy_qaplayer00001')??{...others[0],playerId:'capy_qaplayer00001',nickname:'泡汤队长',bestWave:37,rank:12,avatarId:'capybara'};
  return route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({ok:true,totalPlayers:entries.length+(me?0:1),entries,me:mine})});
 });
}
try{
 for(const [name,width,height] of [['desktop',1366,768],['mobile-landscape',844,390],['mobile-portrait',390,844]]){
  if(only&&only!==name)continue;
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:name.startsWith('mobile')});const p=await ctx.newPage();
  p.on('pageerror',e=>errors.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(name+': '+m.text());});
  // ── Phase A · local mode ──
  // 1 · Start screen: the warm-gold pill mirrors today's soak; 3 + 3 docks untouched.
  await ready(p);
  assert.ok(await p.locator('#menu-screen .active-broth-pill').count(),name+' soak pill');
  assert.equal(await p.locator('#menu-screen .endless-hall-pill .endless-hall-ready').innerText(),'可升级!');
  assert.equal(await p.locator('#menu-screen .endless-hall-pill .endless-hall-best').innerText(),'W37');
  await startLayout(p,name);await shot(p,`p17-${name}-1-start-medallion-pill`);
  // 2 · Medallion hall: six cream rows, the endless-only strip, an upgrade.
  await p.locator('#menu-screen .endless-hall-pill').click();await p.locator('.medallion-dialog[open]').waitFor();await p.waitForTimeout(300);
  assert.equal(await p.locator('#game-dialog[open] .medallion-row').count(),6,name+' six rows');
  assert.ok((await p.locator('#game-dialog[open] .medallion-endless-note').innerText()).includes('仅在无尽模式'),name+' endless-only note');
  const mascot=await rect(p,'#game-dialog[open] .ledger-mascot'),tab=await rect(p,'#game-dialog[open] .ledger-tabs button');
  assert.ok(Math.abs(mascot.bottom-tab.y)<=6,`${name} medallion mascot paws ${mascot.bottom} vs tab ${tab.y}`);
  await ledgerLayout(p,name+' medallion hall');await shot(p,`p17-${name}-2a-medallion-hall`);
  const before=(await saved(p)).endlessMedallions.med_luck_rate;
  await action(p,'medallion-up:med_luck_rate');await p.waitForTimeout(200);
  const after=await saved(p);assert.equal(after.endlessMedallions.med_luck_rate,before+1,name+' upgraded');assert.equal(after.endlessCrests,1260-104,name+' crests spent');
  assert.ok(await p.locator('#game-dialog[open] .medallion-row.is-focused[data-medallion-id="med_luck_rate"]').count(),name+' focused row');
  await shot(p,`p17-${name}-2b-medallion-upgraded`);
  await p.locator('#game-dialog[open] .ledger-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});await p.waitForTimeout(150);await shot(p,`p17-${name}-2c-medallion-maxed-and-footer`);
  // 3 · Global board (local mode): clear notice, own best, nickname validation and save.
  await action(p,'endless-board');await p.locator('.endless-board-dialog[open]').waitFor();await p.waitForTimeout(250);
  assert.ok((await p.locator('#game-dialog[open] .endless-board-status').innerText()).includes('全球榜尚未连接'),name+' unconfigured notice');
  assert.ok(await p.locator('#game-dialog[open] .endless-board-row[data-player="true"]').count(),name+' own local row');
  await p.locator('#game-dialog[open] [data-endless-nickname]').fill('水');await p.locator('#game-dialog[open] [data-endless-nickname]').press('Enter');await p.waitForTimeout(200);
  assert.equal((await saved(p)).nickname,'',name+' short name rejected');assert.ok((await p.locator('#toast').innerText()).includes('至少 2'),name+' short toast');
  await p.locator('#game-dialog[open] [data-endless-nickname]').fill('泡汤队长');await action(p,'endless-name-save');await p.waitForTimeout(200);
  assert.equal((await saved(p)).nickname,'泡汤队长',name+' nickname saved');
  await ledgerLayout(p,name+' board local');await shot(p,`p17-${name}-3-board-local-mode`);
  await action(p,'close-profile');await p.waitForTimeout(200);assert.equal(await p.locator('#game-dialog[open]').count(),0,name+' overlay closed back to menu');
  // ── Phase B · mocked Worker ──
  await mockBoard(p);await ready(p,{nickname:'泡汤队长'});
  await p.locator('#menu-screen [data-action="leaderboard"]').click();await p.locator('.profile-dialog[open]').waitFor();
  await action(p,'endless-board');await p.locator('.endless-board-dialog[open] .endless-board-row').first().waitFor();await p.waitForTimeout(400);
  assert.equal(await p.locator('#game-dialog[open] .endless-board-status').count(),0,name+' online without notice');
  assert.ok((await p.locator('#game-dialog[open] .endless-board-rank').innerText()).includes('#12'),name+' my global rank');
  assert.ok(await p.locator('#game-dialog[open] .endless-board-row').count()>=20,name+' top list');
  await ledgerLayout(p,name+' board online');await shot(p,`p17-${name}-4-board-online`);
  await action(p,'close-profile');
  // 5 · Endless battle: momentum, breakthrough panel, 可突破 highlight, awakening, bubble shield.
  await p.evaluate(()=>{window.__CAPY_DEBUG__.start();const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;
   const place=(kind,level,col,row)=>{const r=e.grant(kind);const u=e.state.units.find(u=>u.id===r.unitId);u.level=level;if(col!==undefined){e.state.grid[row][col]='O';u.location={zone:'board',col,row};}return u;};
   const hero=place('kungfu_po',5,3,2);place('rocket_coon',5,5,2);place('zen_master',4,2,3);place('hamster',3,4,1);
   for(let i=0;i<30;i++)e.hurt(e.spawnEnemy('rat','player'),1e9,hero,false,false,true);
   for(let i=0;i<3;i++)e.hurt(e.spawnEnemy('husky_wrecker','player'),1e9,hero,false,false,true);
   e.state.enemies=[];e.state.wave=10;e.state.time=420;e.finish('player','waves');});
  await p.locator('.endless-offer-ledger[open]').waitFor();await p.waitForTimeout(300);
  assert.ok((await p.locator('#game-dialog[open] .endless-growth').innerText()).includes('×1.25'),name+' offer curve copy');
  assert.ok(await p.locator('#game-dialog[open] .endless-offer-crest').count(),name+' offer crest');
  await shot(p,`p17-${name}-5a-endless-offer`);
  await action(p,'enter-endless');await p.waitForTimeout(300);
  const ids=await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.enemies=[];
   const part=e.state.units.find(u=>u.kind==='panda')??(()=>{const r=e.grant('panda');return e.state.units.find(u=>u.id===r.unitId);})();
   return{hero:e.state.units.find(u=>u.kind==='kungfu_po').id,part:part.id,ready:e.state.sides.player.capyShieldReady,endless:e.state.endless};});
  assert.equal(ids.endless,true,name+' endless');assert.equal(ids.ready,true,name+' shield ready');
  await select(p,ids.hero);
  assert.ok(await p.locator('#live-unit-card .live-breakthrough').count(),name+' breakthrough panel');
  const chance=await p.locator('#live-unit-card [data-live-chance]').innerText();assert.match(chance,/成功率 \d+%/,name+' chance');
  assert.ok((await p.locator('#live-unit-card [data-live-momentum]').innerText()).includes('战意 45/200'),name+' momentum');
  await shot(p,`p17-${name}-5b-breakthrough-panel-and-shield`);
  await select(p,ids.part);await p.waitForTimeout(150);await shot(p,`p17-${name}-5c-can-break-highlight`);
  await p.evaluate(({part,hero})=>{const e=window.__CAPY_DEBUG__.engine;e.endlessRandom={next:()=>0};const h=e.state.units.find(u=>u.id===hero);return e.move(part,{...h.location});},ids);
  await p.waitForTimeout(500);
  assert.equal(await p.evaluate(id=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.id===id).awakened,ids.hero),true,name+' awakened');
  await select(p,ids.hero);await p.waitForTimeout(900);
  assert.ok((await p.locator('#live-unit-card .live-awakened').innerText()).includes('已觉醒突破'),name+' awakened badge');
  assert.ok(await p.evaluate(()=>window.__CAPY_DEBUG__.engine?true:false));
  await shot(p,`p17-${name}-5d-awakened-hero-ring-embers`);
  // Deselect so the card does not cover the tub; the giant orange cat passive would otherwise catch the thief first.
  await p.keyboard.press('Escape');await p.waitForTimeout(150);await shot(p,`p17-${name}-5e-shield-bubble-ready`);
  await p.evaluate(async()=>{const {getMap}=await import('/src/config/maps.ts');const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.giantCatUses=2;const rat=e.spawnEnemy('rat','player');rat.progress=getMap(e.state.mapId).paths.player.length-1.01;});
  await p.waitForTimeout(220);
  const shield=await p.evaluate(()=>{const s=window.__CAPY_DEBUG__.engine.state;return{ready:s.sides.player.capyShieldReady,timer:s.sides.player.capyShieldTimer,oranges:s.sides.player.oranges,pop:s.events.some(e=>e.type==='shield_block')};});
  assert.equal(shield.ready,false,name+' shield consumed');assert.equal(shield.pop,true,name+' shield pop');
  await shot(p,`p17-${name}-5f-shield-block-pop`);await p.waitForTimeout(900);await shot(p,`p17-${name}-5g-shield-recharge-bar`);
  // 6 · Settlement: crests on the shelf, awakened MVP, global rank from the mocked Worker.
  // Clear Wave 11 honestly (the receipt rejects crest claims beyond the cleared waves), then settle.
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.enemies=[];e.state.spawned=e.currentWaveTargetCount();e.callEarlyWave();e.surrender();});
  await p.locator('.result-ledger[open]').waitFor();await p.locator('#game-dialog[open] .crest-global-rank').waitFor({timeout:4000});await p.waitForTimeout(500);
  assert.ok((await p.locator('#game-dialog[open] .crest-global-rank').innerText()).includes('#7'),name+' global rank badge');
  await shot(p,`p17-${name}-6a-endless-result-global-rank`);
  await action(p,'toggle-result-stats');await p.waitForTimeout(350);
  assert.ok(await p.locator('#game-dialog[open] .visual-mvp-portrait [data-sticker="kungfu_po_awakened"]').count(),name+' awakened MVP');
  assert.ok(await p.locator('#game-dialog[open] .visual-treasure-item.is-crest [data-sticker="ui_endless_crest"]').count(),name+' crest on shelf');
  await shot(p,`p17-${name}-6b-report-mvp-awakened`);
  await p.locator('#game-dialog[open] .visual-treasure-shelf').scrollIntoViewIfNeeded();await shot(p,`p17-${name}-6c-report-crests`);
  const banked=await saved(p);assert.equal(banked.endlessCrests,1260+3+1,name+' crests banked');assert.equal(banked.bestEndlessWave,37,name+' best kept');
  checks.push(name+': medallion pill + 3/3 docks clear; hall rows/upgrade/mascot ledge; board local notice + nickname validation; online Top list + my rank; offer ×1.25 + crest; momentum + chance panel; 可突破 highlight; awakening sticker/ring/badge; shield pop + recharge; result global rank, awakened MVP and crest shelf');
  await ctx.close();
 }
 assert.deepEqual(errors,[],'runtime errors');
}catch(error){failure=error;console.error(error);const page=browser.contexts().flatMap(c=>c.pages()).at(-1);if(page)await shot(page,'p17-qa-last-failure');}
finally{await browser.close();fs.writeFileSync(path.join(out,'p17-browser-report.json'),JSON.stringify({passed:!failure&&errors.length===0,checks,layouts,shots,errors,failure:failure?.stack},null,2));}
if(failure)process.exitCode=1;else console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:shots.length,errors:errors.length}));
