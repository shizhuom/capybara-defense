// P16 Onsen Village visual QA (dev server; set P16_DEV_URL, default http://127.0.0.1:4176/).
//   node scripts/p16-browser-qa.mjs [desktop|mobile-landscape|mobile-portrait]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/p16-browser-tmp');
fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(out,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const URL_=process.env.P16_DEV_URL??'http://127.0.0.1:4176/',only=process.argv[2];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],layouts=[],shots=[];let failure;
const shot=async(p,name)=>{await p.screenshot({path:path.join(out,name+'.png')});shots.push(name+'.png');};
const HOUR=3600_000;
/** Seeds a save through the app's own modules; `village` may be a function of `now`. */
async function ready(p,{patch={},village={},full=false}={}){
 await p.goto(URL_,{waitUntil:'networkidle'});
 await p.evaluate(async({patch,village,full})=>{
  const {createProfile,unlockAllProfile}=await import('/src/core/MetaProgression.ts');
  const base=full?unlockAllProfile(createProfile()):createProfile(),now=Date.now();
  const profile=Object.assign(base,{stars:20,highestStars:20,selectedMap:'sunny_backyard',tutorialCompleted:true,tutorialRewardClaimed:true,earlyWaveTipSeen:true,coins:420},patch);
  profile.village={...profile.village,...village,...(village.hoursAgo!==undefined?{lastHarvestAt:now-village.hoursAgo*3600_000}:{})};delete profile.village.hoursAgo;
  profile.settings.musicVolume=profile.settings.soundVolume=0;
  localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.setItem('capybara_defense_v1:language','zh-CN');
 },{patch,village,full});
 await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});await p.waitForTimeout(250);
}
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
const rect=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};},sel);
const overlaps=(a,b)=>a&&b&&a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
async function action(p,id){await p.locator(`#game-dialog[open] [data-action="${id}"]`).filter({visible:true}).first().click();await p.waitForTimeout(120);}
async function startLayout(p,name){
 const buttons=await p.evaluate(()=>[...document.querySelectorAll('#menu-screen .hub-dock button')].map(b=>{const r=b.getBoundingClientRect();return{a:b.dataset.action,dock:b.parentElement.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 assert.deepEqual(buttons.filter(b=>b.dock.includes('left')).map(b=>b.a),['recipes','armory','kitchen'],name+' left dock');
 assert.deepEqual(buttons.filter(b=>b.dock.includes('right')).map(b=>b.a),['village','market','leaderboard'],name+' right dock');
 for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)assert.equal(overlaps(buttons[i],buttons[j]),false,`${name} ${buttons[i].a}/${buttons[j].a} overlap`);
 const start=await rect(p,'#menu-screen .start-button'),chips=await rect(p,'#menu-screen .map-chips');
 for(const b of buttons){assert.equal(overlaps(b,start),false,`${name} ${b.a} vs Start`);assert.equal(overlaps(b,chips),false,`${name} ${b.a} vs maps`);}
 layouts.push({label:name+' start',buttons});
}
/** Everything placed on the panorama must stay inside it; nothing in the ledger may overflow sideways. */
async function villageLayout(p,label){
 const report=await p.evaluate(()=>{
  const q=s=>document.querySelector('#game-dialog[open] '+s),r=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom};};
  const stage=q('.village-diorama');const box=stage?r(stage):null;
  const items=[...document.querySelectorAll('#game-dialog[open] .village-diorama :is(.village-spot,.village-pet)')].map(e=>({cls:String(e.className),...r(e)}));
  const overflow=[...document.querySelectorAll('#game-dialog[open] :is(.ledger-body,.village-harvest-bar,.village-row,.storybook-footer-tip)')].filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+2).map(e=>String(e.className));
  const dialog=r(document.querySelector('#game-dialog[open]'));
  return{box,items,overflow,dialog,viewport:{w:innerWidth,h:innerHeight},broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),raw:/\b(?:p16|facility)\.[\w.]+/.test(document.querySelector('#game-dialog[open]').innerText)};
 });
 layouts.push({label,...report});
 assert.deepEqual(report.overflow,[],label+' overflow');assert.deepEqual(report.broken,[],label+' broken image');assert.equal(report.raw,false,label+' raw key');
 assert.ok(report.dialog.x>=-1&&report.dialog.right<=report.viewport.w+1,label+' dialog fits');
 if(report.box)for(const it of report.items)assert.ok(it.x>=report.box.x-2&&it.right<=report.box.right+2&&it.y>=report.box.y-2&&it.bottom<=report.box.bottom+2,`${label} ${it.cls} leaves the panorama ${JSON.stringify(it)} vs ${JSON.stringify(report.box)}`);
}
try{
 for(const [name,width,height] of [['desktop',1366,768],['mobile-landscape',844,390],['mobile-portrait',390,844]]){
  if(only&&only!==name)continue;
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:name.startsWith('mobile')});const p=await ctx.newPage();
  p.on('pageerror',e=>errors.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(name+': '+m.text());});
  // 1 · Start screen: left 3 + right 3, Build! then Harvest! badge.
  await ready(p);
  assert.equal(await p.locator('#menu-screen .village-build-badge').innerText(),'可建造!');
  await startLayout(p,name+' build badge');await shot(p,`p16-${name}-1a-start-build-badge`);
  await ready(p,{village:{hoursAgo:13}});
  assert.equal(await p.locator('#menu-screen .village-harvest-badge').innerText(),'领收成!');
  await startLayout(p,name+' harvest badge');await shot(p,`p16-${name}-1b-start-harvest-badge`);
  // 2 · Courtyard with the starter pool, empty plots and the full harvest basket.
  await p.locator('#menu-screen [data-action="village"]').click();await p.locator('.village-dialog[open]').waitFor();await p.waitForTimeout(300);
  const mascot=await rect(p,'#game-dialog[open] .ledger-mascot'),tab=await rect(p,'#game-dialog[open] .ledger-tabs button');
  assert.ok(Math.abs(mascot.bottom-tab.y)<=6,`${name} village mascot paws ${mascot.bottom} vs tab ${tab.y}`);
  assert.equal(await p.locator('#game-dialog[open] .village-spot.is-empty').count(),4);
  await villageLayout(p,name+' courtyard starter');await shot(p,`p16-${name}-2a-courtyard-starter`);
  const before=await saved(p);
  await action(p,'village-harvest');await p.waitForTimeout(200);
  const after=await saved(p);assert.ok(after.coins>before.coins,name+' harvest coins');assert.ok(after.village.lastHarvestAt>before.village.lastHarvestAt,name+' harvest anchor');
  assert.ok(await p.locator('#game-dialog[open] .village-harvest-btn[disabled]').count(),name+' basket emptied');
  await shot(p,`p16-${name}-2b-harvested`);
  // 3 · Pet a resident: hop, heart, quote and +5 coins.
  const coins=(await saved(p)).coins;
  await p.locator('#game-dialog[open] .village-pet').first().click();await p.waitForTimeout(260);
  assert.ok(await p.locator('#game-dialog[open] .village-pet-bubble [data-sticker="ui_pet_heart"]').count(),name+' heart bubble');
  assert.equal((await saved(p)).coins,coins+5,name+' pocket money');
  await villageLayout(p,name+' pet bubble');await shot(p,`p16-${name}-3-pet-bubble`);
  // 4 · Empty plot → build tab with the row highlighted → build it.
  await p.waitForTimeout(1900);await action(p,'village-focus:fac_fish_stall');
  assert.ok(await p.locator('#game-dialog[open] .village-row.is-focused[data-facility-id="fac_fish_stall"]').count(),name+' focused row');
  await villageLayout(p,name+' build tab');await shot(p,`p16-${name}-4a-build-tab`);
  await action(p,'village-build:fac_fish_stall');await p.waitForTimeout(150);
  assert.equal((await saved(p)).village.facilities.fac_fish_stall,1,name+' built stall');
  await shot(p,`p16-${name}-4b-built-stall`);
  await action(p,'village-tab:courtyard');await p.waitForTimeout(200);await shot(p,`p16-${name}-4c-courtyard-with-stall`);
  await action(p,'close-village');
  // 5 · Fully built village: five residents, harvest preview with fragments, yuzu and tickets.
  await ready(p,{full:true,patch:{mergedHeroes:['kungfu_po','puss_in_hat','zen_master']},village:{hoursAgo:12}});
  await p.locator('#menu-screen [data-action="village"]').click();await p.locator('.village-dialog[open]').waitFor();await p.waitForTimeout(400);
  assert.equal(await p.locator('#game-dialog[open] .village-pet').count(),5,name+' five residents');
  assert.equal(await p.locator('#game-dialog[open] .village-spot.is-built').count(),5,name+' five facilities');
  await villageLayout(p,name+' full courtyard');await shot(p,`p16-${name}-5a-courtyard-full`);
  await p.locator('#game-dialog[open] .village-pet').nth(4).click();await p.waitForTimeout(260);await shot(p,`p16-${name}-5b-full-pet-bubble`);
  await p.waitForTimeout(1900);await action(p,'village-tab:build');await villageLayout(p,name+' full build');await shot(p,`p16-${name}-5c-build-maxed`);
  await action(p,'close-village');
  // 6 · Battle: gathered materials on the pause tray and the report shelf.
  await p.evaluate(()=>{window.__CAPY_DEBUG__.start();const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;
   for(const [kind,col,row] of [['hamster',2,1],['panda',3,1]]){const r=e.grant(kind);const u=e.state.units.find(u=>u.id===r.unitId);e.state.grid[row][col]='O';u.location={zone:'board',col,row};}
   e.state.sides.player.villageLoot=['res_onsen_wood','res_onsen_wood','res_yuzu_essence'];});
  await p.waitForTimeout(250);await p.locator('#pause-button').click();await p.locator('.pause-ledger[open] .pause-materials').waitFor();
  await shot(p,`p16-${name}-6a-pause-materials`);await action(p,'resume');
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.wave=10;e.state.time=150;const u=e.state.units.find(u=>u.kind==='hamster'),enemy=e.spawnEnemy('rat','player');enemy.hp=600;enemy.maxHp=600;e.hurt(enemy,600,u,true);e.state.enemies=[];e.finish('player','waves');});
  await p.locator('.endless-offer-ledger[open]').waitFor();await action(p,'decline-endless');await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(600);
  await action(p,'toggle-result-stats');await p.waitForTimeout(300);
  for(const id of ['res_onsen_wood','res_yuzu_essence'])assert.ok(await p.locator(`#game-dialog[open] .visual-treasure-item.is-material [data-sticker="${id}"]`).count(),`${name} report ${id}`);
  const shelf=await p.evaluate(()=>{const d=document.querySelector('#game-dialog[open] .crest-stats-drawer').getBoundingClientRect();return{x:d.x,right:d.right,w:innerWidth};});
  assert.ok(shelf.x>=-1&&shelf.right<=shelf.w+1,name+' drawer fits');
  await p.locator('#game-dialog[open] .visual-treasure-shelf').scrollIntoViewIfNeeded();await shot(p,`p16-${name}-6b-report-materials`);
  const banked=await saved(p);assert.ok(banked.village.wood>=99+4,name+' banked wood');
  checks.push(name+': left 3 + right 3 docks without overlap; Build!/Harvest! badges; courtyard plots and residents inside the panorama; harvest claim; pet heart +5; focus → build; full village 5 residents; materials on pause tray and report shelf');
  await ctx.close();
 }
 assert.deepEqual(errors,[],'runtime errors');
}catch(error){failure=error;console.error(error);const page=browser.contexts().flatMap(c=>c.pages()).at(-1);if(page)await shot(page,'p16-qa-last-failure');}
finally{await browser.close();fs.writeFileSync(path.join(out,'p16-browser-report.json'),JSON.stringify({passed:!failure&&errors.length===0,checks,layouts,shots,errors,failure:failure?.stack},null,2));}
if(failure)process.exitCode=1;else console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:shots.length,errors:errors.length}));
