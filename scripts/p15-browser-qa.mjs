// P15 visual QA: five-layer guardian bath on the BUILT app, wide-belly settlement via the dev hook.
//   npm run build && npm run dev (any port; set P15_DEV_URL, default http://127.0.0.1:4176/)
//   node scripts/p15-browser-qa.mjs [desktop|mobile-landscape|mobile-portrait]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/p15-browser-tmp');
fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(out,{recursive:true});process.env.TEMP=process.env.TMP=temp;
assert.ok(fs.existsSync(path.join(dist,'index.html')),'run npm run build first');
const DIST='http://p15-dist.test/',DEV=process.env.P15_DEV_URL??'http://127.0.0.1:4176/',only=process.argv[2];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],layouts=[],shots=[];let failure;
const shot=async(p,name,clip)=>{await p.screenshot({path:path.join(out,name+'.png'),...(clip?{clip}:{})});shots.push(name+'.png');};
const BATHS={
 sunny_backyard:{x:1053.5,y:531,size:74},sakura_onsen:{x:263,y:490,size:90},midnight_kitchen:{x:1055,y:323,size:80},cat_tower_maze:{x:1054,y:325,size:74},
};
const ALL_BROTHS=['dish_yuzu_bath','dish_bamboo_broth','dish_honey_osmanthus','dish_ginger_soak','dish_spicy_hotpot','dish_sakura_milk','dish_matcha_tea','dish_herbal_tonic','dish_truffle_ramen','dish_chill_melon','dish_golden_feast','dish_imperial_onsen'];
/** A plain JSON save is enough: the app normalizes every missing field itself (no dev imports needed). */
function profileJson(patch={}){
 return JSON.stringify({schemaVersion:2,coins:500,wins:12,matches:15,stars:180,highestStars:180,tutorialCompleted:true,tutorialRewardClaimed:true,earlyWaveTipSeen:true,
  selectedMap:'sunny_backyard',unlockedBroths:ALL_BROTHS,brothLevels:Object.fromEntries(ALL_BROTHS.map(id=>[id,3])),activeBrothId:null,ingredients:{},
  settings:{musicVolume:0,soundVolume:0,showDamageNumbers:true},...patch});
}
async function distPage(context){
 await context.route(DIST+'**',async r=>{
  const relative=decodeURIComponent(new URL(r.request().url()).pathname.slice(1))||'index.html',file=path.resolve(dist,relative);
  assert.ok(file.startsWith(dist+path.sep)||file===path.join(dist,'index.html'));
  await r.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{status:200,contentType:mime[path.extname(file)]??'application/octet-stream',body:fs.readFileSync(file)}:{status:404,body:'Not found'});
 });
 return context.newPage();
}
async function canvasClip(p,bath,scale=1.3){
 const box=await p.locator('#battle-canvas').boundingBox(),k=box.width/1280,R=bath.size*scale;
 return{x:box.x+(bath.x-R)*k,y:box.y+(bath.y-R*1.35)*k,width:2*R*k,height:2.35*R*k};
}
async function action(p,id){await p.locator(`#game-dialog[open] [data-action="${id}"]`).filter({visible:true}).first().click();await p.waitForTimeout(90);}
async function devReady(p,patch){
 await p.goto(DEV,{waitUntil:'networkidle'});
 await p.evaluate(json=>{localStorage.setItem('capybara_defense_v1:profile',json);localStorage.setItem('capybara_defense_v1:language','zh-CN');},profileJson(patch));
 await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});
}
async function devBattle(p){
 await p.evaluate(()=>{window.__CAPY_DEBUG__.start();const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.state.sides.player.food=300;
  for(const [kind,col,row] of [['hamster',2,1],['panda',3,1],['squirrel',6,3]]){const r=e.grant(kind);const u=e.state.units.find(u=>u.id===r.unitId);e.state.grid[row][col]='O';u.location={zone:'board',col,row};}});
 await p.waitForTimeout(250);
}
/** Plaque content must stay inside the cream belly: no overflow, every icon and number inside the plaque box. */
async function crestLayout(p,label){
 const report=await p.evaluate(()=>{
  const q=s=>document.querySelector('#game-dialog[open] '+s),rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const plaque=q('.crest-plaque-body'),stage=q('.crest-stage');
  const parts=[...document.querySelectorAll('#game-dialog[open] .crest-plaque-body :is(.crest-rank-name,.crest-rank-delta,.crest-exp-bar,.crest-exp-count,.crest-reward,.crest-endless-capsule)')].map(el=>({cls:String(el.className),...rect(el)}));
  const name=q('.crest-rank-name');
  return{plaque:rect(plaque),stage:rect(stage),parts,truncated:name.scrollWidth>name.clientWidth+1,overflow:[...document.querySelectorAll('#game-dialog[open] :is(.crest-plaque-body,.crest-core-rewards,.crest-rank-line,.visual-report-scroll,.crest-stats-drawer)')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+2).map(el=>String(el.className)),
   viewport:{w:innerWidth,h:innerHeight},broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),emoji:/⏱/.test(document.querySelector('#game-dialog[open]').innerHTML)};
 });
 layouts.push({label,...report});
 assert.deepEqual(report.overflow,[],label+' overflow');assert.deepEqual(report.broken,[],label+' broken image');assert.equal(report.emoji,false,label+' raw ⏱ emoji');
 assert.equal(report.truncated,false,label+' rank name truncated');
 for(const part of report.parts)assert.ok(part.x>=report.plaque.x-1&&part.right<=report.plaque.right+1&&part.y>=report.plaque.y-1&&part.bottom<=report.plaque.bottom+1,`${label} ${part.cls} escapes plaque ${JSON.stringify(part)} vs ${JSON.stringify(report.plaque)}`);
 assert.ok(report.stage.x>=-1&&report.stage.right<=report.viewport.w+1,label+' stage fits width');
 return report;
}
async function drawerLayout(p,label){
 const report=await p.evaluate(()=>{
  const drawer=document.querySelector('#game-dialog[open] .crest-stats-drawer'),r=drawer.getBoundingClientRect();
  return{drawer:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},viewport:{w:innerWidth,h:innerHeight},clock:!!drawer.querySelector('[data-sticker="ui_clock_sand"]'),emoji:/⏱/.test(drawer.textContent),
   overflow:[...drawer.querySelectorAll('*')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+2&&getComputedStyle(el).overflowX!=='visible'&&!el.classList.contains('crest-report-body')&&!el.classList.contains('settlement-sr-only')).map(el=>String(el.className))};
 });
 layouts.push({label,...report});
 assert.ok(report.clock,label+' clock sand');assert.equal(report.emoji,false,label+' no emoji');assert.deepEqual(report.overflow,[],label+' overflow');
 assert.ok(report.drawer.x>=-1&&report.drawer.y>=-1&&report.drawer.right<=report.viewport.w+1&&report.drawer.bottom<=report.viewport.h+1,label+' drawer in viewport');
}
try{
 for(const [name,width,height] of [['desktop',1366,768],['mobile-landscape',844,390],['mobile-portrait',390,844]]){
  if(only&&only!==name)continue;
  // ── Part A: guardian bath on the production build ──
  const dctx=await browser.newContext({viewport:{width,height},hasTouch:name.startsWith('mobile')});const d=await distPage(dctx);
  d.on('pageerror',e=>errors.push(name+' dist: '+e.message));d.on('console',m=>{if(m.type()==='error')errors.push(name+' dist: '+m.text());});
  for(const [map,broth] of [['sunny_backyard','dish_yuzu_bath'],['midnight_kitchen','dish_spicy_hotpot'],['sakura_onsen','dish_sakura_milk'],['cat_tower_maze','dish_matcha_tea'],['sunny_backyard',null]]){
   if(name!=='desktop'&&broth!=='dish_sakura_milk'&&broth!=='dish_yuzu_bath')continue;
   await d.goto(DIST,{waitUntil:'networkidle'});
   await d.evaluate(json=>{localStorage.setItem('capybara_defense_v1:profile',json);localStorage.setItem('capybara_defense_v1:language','zh-CN');},profileJson({selectedMap:map,activeBrothId:broth}));
   await d.reload({waitUntil:'networkidle'});await d.waitForTimeout(400);
   await d.locator('#menu-screen [data-action="start"]').click();await d.waitForTimeout(1700);
   const clip=await canvasClip(d,BATHS[map]),frames=[];
   for(let i=0;i<3;i++){const file=`p15-${name}-bath-${map}-${broth??'clear'}-${i}`;await shot(d,file,clip);frames.push(fs.readFileSync(path.join(out,file+'.png')));if(i<2)await d.waitForTimeout(1400);}
   assert.ok(!frames[0].equals(frames[1])&&!frames[1].equals(frames[2]),`${name} ${map} bath is animated`);
   if(map==='sakura_onsen')await shot(d,`p15-${name}-bath-battlefield`);
  }
  checks.push(name+': built app bath close-ups animate across three captures; rims, soup and capybara composed live');
  await dctx.close();
  // ── Part B: settlements through the dev hook ──
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:name.startsWith('mobile')});const p=await ctx.newPage();
  p.on('pageerror',e=>errors.push(name+' dev: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(name+' dev: '+m.text());});
  // Victory with a win streak (+2★ flame), fragments, ingredients.
  await devReady(p,{winStreak:2,bestWinStreak:2,activeBrothId:'dish_yuzu_bath'});await devBattle(p);
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.wave=10;e.state.time=152;e.state.sides.player.loot=['m01_swatter','m01_swatter','m10_bamboo_staff'];
   e.state.sides.player.ingredientLoot=['ing_yuzu','ing_honey','ing_yuzu','ing_bamboo'];
   const u=e.state.units.find(u=>u.kind==='hamster'),enemy=e.spawnEnemy('rat','player');enemy.hp=1235;enemy.maxHp=1235;e.hurt(enemy,1235,u,true);e.state.enemies=[];e.finish('player','waves');});
  await p.locator('.endless-offer-ledger[open]').waitFor();await action(p,'decline-endless');await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(700);
  assert.ok(await p.locator('#game-dialog[open] .crest-rank-delta.is-streak [data-sticker="ui_streak_flame"]').count(),name+' streak flame');
  assert.ok(await p.locator('#game-dialog[open] .crest-fragments [data-sticker="ui_weapon_fragment"]').count(),name+' fragment icon');
  await crestLayout(p,name+' victory');await shot(p,`p15-${name}-victory-shield`);
  await action(p,'toggle-result-stats');await p.waitForTimeout(350);await drawerLayout(p,name+' victory drawer');await shot(p,`p15-${name}-victory-report`);
  await p.keyboard.press('Escape');await p.waitForTimeout(150);
  // Endless victory.
  await action(p,'menu');await devBattle(p);
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.wave=10;e.state.time=152;const u=e.state.units.find(u=>u.kind==='hamster'),enemy=e.spawnEnemy('rat','player');enemy.hp=500;enemy.maxHp=500;e.hurt(enemy,500,u,true);e.state.enemies=[];e.finish('player','waves');});
  await p.locator('.endless-offer-ledger[open]').waitFor();await action(p,'enter-endless');
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=true;const u=e.state.units.find(u=>u.location.zone==='board');
   for(let i=0;i<900&&e.state.wave<13;i++){for(const enemy of [...e.state.enemies])e.hurt(enemy,enemy.maxHp+100,u,true);e.tick(.05);}e.options.autoWaves=false;});
  await p.locator('#pause-button').click();await action(p,'surrender');await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(700);
  assert.ok(await p.locator('#game-dialog[open] .crest-endless-capsule [data-sticker="ui_endless_emblem"]').count(),name+' endless capsule');
  await crestLayout(p,name+' endless');await shot(p,`p15-${name}-endless-shield`);
  await action(p,'toggle-result-stats');await p.waitForTimeout(350);await drawerLayout(p,name+' endless drawer');await shot(p,`p15-${name}-endless-report`);
  await p.keyboard.press('Escape');await p.waitForTimeout(150);
  // Protected defeat with salvaged ingredients (rank < 10 keeps the star).
  await devReady(p,{stars:5,highestStars:5,wins:2,matches:4,activeBrothId:'dish_sakura_milk'});await devBattle(p);
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.ingredientLoot=['ing_sakura','ing_chili','ing_sakura','ing_bamboo','ing_honey'];e.adjustOranges(-99);});
  await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(700);
  assert.ok(await p.locator('#game-dialog[open] .crest-rank-delta.is-protected [data-sticker="ui_rank_protect_shield"]').count(),name+' protect shield');
  assert.ok((await p.locator('#game-dialog[open] .crest-ingredients').innerText()).includes('+3'),name+' salvage +3');
  await crestLayout(p,name+' defeat');await shot(p,`p15-${name}-defeat-shield`);
  await action(p,'toggle-result-stats');await p.waitForTimeout(350);await drawerLayout(p,name+' defeat drawer');await shot(p,`p15-${name}-defeat-report`);
  checks.push(name+': streak victory, endless victory and protected defeat shields keep every icon/number inside the cream belly; drawers use clock sand, no emoji');
  await ctx.close();
 }
 assert.deepEqual(errors,[],'runtime errors');
}catch(error){failure=error;console.error(error);const page=browser.contexts().flatMap(c=>c.pages()).at(-1);if(page)await shot(page,'p15-qa-last-failure');}
finally{await browser.close();fs.writeFileSync(path.join(out,'p15-browser-report.json'),JSON.stringify({passed:!failure&&errors.length===0,checks,layouts,shots,errors,failure:failure?.stack},null,2));}
if(failure)process.exitCode=1;else console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:shots.length,errors:errors.length}));
