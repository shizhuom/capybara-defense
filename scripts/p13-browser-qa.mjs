import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/p13-browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],layouts=[],shots=[];let failure;
const url='http://127.0.0.1:4175/';
const shot=async(p,name)=>{await p.screenshot({path:path.join(out,name+'.png')});shots.push(name+'.png');};
async function action(p,id){await p.locator(`#game-dialog[open] [data-action="${id}"]`).filter({visible:true}).first().click();await p.waitForTimeout(70);}
async function ready(p,lang='zh-CN',tipSeen=true){
 await p.goto(url,{waitUntil:'networkidle'});
 await p.evaluate(async({lang,tipSeen})=>{
  const {createProfile,unlockAllProfile}=await import('/src/core/MetaProgression.ts');
  const profile=unlockAllProfile(createProfile());Object.assign(profile,{stars:20,highestStars:20,selectedMap:'sunny_backyard',tutorialCompleted:true,tutorialRewardClaimed:true,earlyWaveTipSeen:tipSeen,coins:1500,freeLotteryTickets:2});
  profile.equippedActiveProps=['milk_bottle','glue_trap'];profile.equippedPassiveProps=['auto_shovel','extra_oranges','bee_overtime','tall_perch','gold_doge','emp_jammer'];
  profile.settings.musicVolume=profile.settings.soundVolume=0;
  localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.setItem('capybara_defense_v1:language',lang);
 },{lang,tipSeen});
 await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});
}
async function battle(p){
 await p.evaluate(()=>{window.__CAPY_DEBUG__.start();const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.state.sides.player.food=300;e.state.sides.player.oranges=3;e.state.sides.player.loot=[];
  for(const [kind,col,row] of [['hamster',2,1],['panda',3,1],['hat_bamboo',4,1],['squirrel',6,3]]){const r=e.grant(kind);const u=e.state.units.find(u=>u.id===r.unitId);e.state.grid[row][col]='O';u.location={zone:'board',col,row};}
  e.grant('hamster');
 });await p.waitForTimeout(180);
}
async function point(p,x,y){const b=await p.locator('#battle-canvas').boundingBox();return{x:b.x+x/1280*b.width,y:b.y+y/720*b.height};}
async function clickStage(p,x,y){const q=await point(p,x,y);await p.mouse.click(q.x,q.y);await p.waitForTimeout(150);}
async function drag(p,selector,x,y,{midShot,replace=false}={}){
 const start=await p.locator(selector).boundingBox(),q=await point(p,x,y);
 await p.mouse.move(start.x+start.width/2,start.y+start.height/2);await p.mouse.down();
 await p.mouse.move(q.x,q.y,{steps:12});await p.waitForTimeout(180);
 if(replace)await p.locator(selector).evaluate(button=>button.replaceWith(button.cloneNode(true)));
 if(midShot)await shot(p,midShot);
 await p.mouse.up();await p.waitForTimeout(140);
}
async function layout(p,label){
 const report=await p.evaluate(()=>{
  const dialog=document.querySelector('#game-dialog[open]');const scope=dialog??document.querySelector('#stage');
  const visible=el=>{const r=el.getBoundingClientRect();return !!(r.width&&r.height)&&!el.closest('[hidden]')&&getComputedStyle(el).visibility!=='hidden';};
  const sels=dialog?['.crest-stage','.crest-plaque-body','.crest-ribbon-title','.crest-stats-drawer','.endless-offer-shell','.pause-storybook-actions']:['#passive-rail','.early-tip-bubble','#live-unit-card','#early-wave-button','.control-dock'];
  const boxes=sels.flatMap(sel=>[...scope.querySelectorAll(sel)].filter(visible).map(el=>{const r=el.getBoundingClientRect();return{sel,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  const overflow=[...scope.querySelectorAll(dialog?'.crest-plaque-body,.crest-stats-drawer,.visual-report-scroll,.endless-offer-shell,.pause-storybook-actions':'.early-tip-bubble,#live-unit-card')].filter(visible).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({cls:el.className,width:el.clientWidth,scroll:el.scrollWidth}));
  return{width:innerWidth,height:innerHeight,boxes,overflow,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),raw:/\bp13(?:Settlement)?\.[\w.]+/.test(scope.innerText)};
 });layouts.push({label,...report});assert.deepEqual(report.overflow,[],label+' overflow');assert.deepEqual(report.broken,[],label+' broken image');assert.equal(report.raw,false,label+' raw translation');
 for(const r of report.boxes)assert.ok(r.x>=-1&&r.y>=-1&&r.right<=report.width+1&&r.bottom<=report.height+1,`${label} out-of-viewport ${r.sel}: ${JSON.stringify(r)}`);
}
async function standardWin(p){
 await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.wave=10;e.state.time=145;e.state.sides.player.loot=['m01_swatter','m01_swatter','m10_bamboo_staff'];e.state.sides.player.oranges=3;
  const u=e.state.units.find(u=>u.kind==='hamster'),enemy=e.spawnEnemy('rat','player');enemy.hp=1235;enemy.maxHp=1235;e.hurt(enemy,1235,u,true);e.state.enemies=[];e.finish('player','waves');
 });await p.locator('.endless-offer-ledger[open]').waitFor();await p.waitForTimeout(180);
}
try{
 for(const [name,width,height] of [['desktop',1366,768],['1080p',1920,1080],['mobile-landscape',844,390],['mobile-portrait',390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:name.startsWith('mobile')});const p=await context.newPage();
  p.on('pageerror',e=>errors.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(name+': '+m.text());});
  await ready(p,'zh-CN',false);await battle(p);
  await p.locator('#early-wave-coachmark:not([hidden])').waitFor();await layout(p,name+' coaching');await shot(p,`p13-${name}-early-wave-coachmark`);
  await p.locator('[data-action="dismiss-early-tip"]').click();assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.earlyWaveTipSeen),true);
  await clickStage(p,432,228);await layout(p,name+' rail/card');
  const overlap=await p.evaluate(()=>{const a=document.querySelector('#passive-rail').getBoundingClientRect(),b=document.querySelector('#live-unit-card').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});assert.equal(overlap,false,name+' passive/card overlap');
  for(const speed of ['2×','3×','1×','2×','3×']){await p.locator('#hud-speed').click();assert.equal(await p.locator('#hud-speed').innerText(),speed);}
  await shot(p,`p13-${name}-speed3-passive-rail`);
  // Release outside the battlefield is a true cancellation, not an accidental global cast.
  await drag(p,'[data-prop-drag="sprinkler"]',85,420);assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.sprinklerUsed),false);
  // Magnetic target above the unit's head; captured root survives replacement of the initiating button.
  await drag(p,'[data-prop-drag="milk_bottle"]',432,174,{midShot:`p13-${name}-milk-drag`,replace:true});
  assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.kind==='hamster'&&u.location.zone==='board').level),2);
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.propCooldowns.milk_bottle=0;});await p.waitForTimeout(150);
  await drag(p,'[data-prop-drag="milk_bottle"]',85,420);assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.propCooldowns.milk_bottle),0);
  await drag(p,'[data-prop-drag="milk_bottle"]',298,656);assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.kind==='hamster'&&u.location.zone==='bench').level),2);
  const road=await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;for(let row=0;row<5;row++)for(let col=0;col<9;col++)if(e.state.grid[row][col]==='R')return{x:172+(col+.5)*104,y:72+(row+.5)*104};});
  await drag(p,'[data-prop-drag="glue_trap"]',road.x,road.y,{midShot:`p13-${name}-road-trap-drag`});assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.traps.length),1);
  await drag(p,'[data-prop-drag="sprinkler"]',600,350,{midShot:`p13-${name}-sprinkler-drag`});assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.sprinklerUsed),true);
  checks.push(name+': root-capture survives button replacement; milk magnetic/bench targets; outside cancellation; glue road; sprinkler; speed cycle; persisted early dismissal; passive/card non-overlap');
  await standardWin(p);const banked=await p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
  assert.equal(banked.matches,1);assert.equal(banked.freeLotteryTickets,3);await layout(p,name+' offer');await shot(p,`p13-${name}-endless-offer`);
  await action(p,'enter-endless');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.wave),11);
  // Play a real clear: force already-spawned foes to die, let the engine schedule every remaining foe.
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=true;const u=e.state.units.find(u=>u.location.zone==='board');
    for(let i=0;i<720&&e.state.wave===11;i++){for(const enemy of [...e.state.enemies])e.hurt(enemy,enemy.maxHp+enemy.shield+100,u,true);e.tick(.05);}
    e.options.autoWaves=false;
  });await p.waitForTimeout(160);assert.ok((await p.locator('#hud-wave').innerText()).includes('♾'));
  assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.endlessCoins),15);
  await shot(p,`p13-${name}-endless-battle`);
  await p.locator('#pause-button').click();await layout(p,name+' endless pause');await shot(p,`p13-${name}-endless-pause`);
  await action(p,'surrender');await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(520);await layout(p,name+' endless victory');await shot(p,`p13-${name}-endless-victory`);
  const final=await p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
  assert.equal(final.stars,banked.stars);assert.equal(final.matches,banked.matches);assert.equal(final.freeLotteryTickets,banked.freeLotteryTickets);assert.equal(final.coins,banked.coins+15);
  await action(p,'toggle-result-stats');await layout(p,name+' report');await shot(p,`p13-${name}-visual-report`);
  await p.keyboard.press('Escape');assert.equal(await p.locator('.crest-stats-drawer').isVisible(),false);
  checks.push(name+': standard banked before offer, same-field wave11, real wave clear bonus, pause cash-out honor result, no repeated star/match/ticket, report drawer');
  await action(p,'menu');await ready(p,'en',true);await battle(p);await standardWin(p);await action(p,'decline-endless');await p.waitForTimeout(500);
  await layout(p,name+' English victory');await shot(p,`p13-${name}-victory-en`);await action(p,'toggle-result-stats');await layout(p,name+' English report');await shot(p,`p13-${name}-report-en`);
  await p.keyboard.press('Escape');await action(p,'menu');await battle(p);
  await p.evaluate(()=>window.__CAPY_DEBUG__.engine.adjustOranges(-99));await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(500);await layout(p,name+' defeat');await shot(p,`p13-${name}-defeat`);
  await context.close();
 }
 assert.deepEqual(errors,[],'runtime errors');
}catch(error){failure=error;console.error(error);const page=browser.contexts().flatMap(c=>c.pages()).at(-1);if(page)await shot(page,'p13-qa-last-failure');}
finally{await browser.close();fs.writeFileSync(path.join(out,'p13-browser-report.json'),JSON.stringify({passed:!failure&&errors.length===0,checks,layouts,shots,errors,failure:failure?.stack},null,2));}
if(failure)process.exitCode=1;else console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:shots.length,errors:errors.length}));
