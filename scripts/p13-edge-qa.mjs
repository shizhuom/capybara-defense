import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification');
process.env.TEMP=process.env.TMP=path.join(root,'.runtime/p13-edge-tmp');fs.mkdirSync(process.env.TEMP,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],checks=[];let failure;
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const cdp=await context.newCDPSession(page);
async function act(id){await page.locator(`[data-action="${id}"]`).filter({visible:true}).first().click();await page.waitForTimeout(100);}
async function point(x,y){const b=await page.locator('#battle-canvas').boundingBox();return{x:b.x+x/1280*b.width,y:b.y+y/720*b.height};}
async function tap(x,y){const p=await point(x,y);await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(120);}
async function touchDrag(id,x,y,screenshot){
 await page.evaluate(()=>{window.__touchLog=[];if(!window.__touchObserver){window.__touchObserver=true;for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture'])document.addEventListener(type,e=>{window.__touchLog?.push({type,id:e.pointerId,primary:e.isPrimary,button:e.button,target:e.target?.getAttribute?.('data-prop-drag')??e.target?.id,x:e.clientX,y:e.clientY,prevented:e.defaultPrevented});});}});
 const b=await page.locator(`[data-prop-drag="${id}"]`).boundingBox(),from={x:b.x+b.width/2,y:b.y+b.height/2},to=await point(x,y);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1,radiusX:4,radiusY:4}]});
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12,id:1,radiusX:4,radiusY:4}]});await page.waitForTimeout(17);}
 const events=await page.evaluate(()=>window.__touchLog);
 assert.ok(events.some(e=>e.type==='gotpointercapture'&&e.target==='app'),id+' persistent root touch capture');
 assert.ok(events.some(e=>e.type==='pointermove'&&e.target==='app'&&e.prevented),id+' real touch aiming');
 if(screenshot)await page.screenshot({path:path.join(out,screenshot+'.png')});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120);
}
async function seedProfile(tutorial=false){
 await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
 await page.evaluate(async tutorial=>{const{createProfile,unlockAllProfile}=await import('/src/core/MetaProgression.ts');const p=tutorial?createProfile():unlockAllProfile(createProfile());
  Object.assign(p,{tutorialCompleted:!tutorial,tutorialRewardClaimed:!tutorial,earlyWaveTipSeen:!tutorial,selectedMap:'sunny_backyard'});
  p.settings.musicVolume=p.settings.soundVolume=0;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(p));localStorage.setItem('capybara_defense_v1:language','zh-CN');
 },tutorial);await page.reload({waitUntil:'networkidle'});
}
async function fixture(id){
 await page.evaluate(id=>{const app=window.__CAPY_DEBUG__;app.start();const e=app.engine;e.options.autoWaves=false;e.state.units=[];e.state.sides.player.oranges=5;
  const s=e.state.sides.player;s.loadout.equippedActiveProps=id==='sprinkler'?[]:[id];s.loadout.ownedProps[id]=1;s.propCooldowns={};
  const r=e.grant(id==='clay'?'panda':'hamster'),u=e.state.units.find(u=>u.id===r.unitId);e.state.grid[1][2]='O';u.location={zone:'board',col:2,row:1};
 },id);await page.waitForTimeout(130);
}
try{
 await seedProfile();
 for(const id of ['washer','clay','milk_bottle','whistle','recycle_bin','catnip','expired_can','glue_trap','sprinkler']){
  await fixture(id);
  const before=await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;return{food:e.state.sides.player.food,oranges:e.state.sides.player.oranges,kind:e.state.units[0].kind};});
  // Every active skill can be returned to the rail without consuming a cooldown or charge.
  await touchDrag(id,85,420);
  assert.equal(await page.evaluate(id=>window.__CAPY_DEBUG__.engine.state.sides.player.propCooldowns[id]??0,id),0);
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.sprinklerUsed),false);
  const target=id==='glue_trap'?await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;for(let y=0;y<5;y++)for(let x=0;x<9;x++)if(e.state.grid[y][x]==='R')return{x:172+(x+.5)*104,y:72+(y+.5)*104};}):['catnip','expired_can','sprinkler'].includes(id)?{x:600,y:350}:{x:432,y:174};
  await touchDrag(id,target.x,target.y,id==='clay'?'p13-mobile-real-touch-clay':undefined);
  const after=await page.evaluate(id=>{const e=window.__CAPY_DEBUG__.engine,s=e.state.sides.player;return{cooldown:s.propCooldowns[id]??0,sprinkler:s.sprinklerUsed,catnip:s.catnipTime,food:s.food,oranges:s.oranges,units:e.state.units.map(u=>({kind:u.kind,level:u.level,washing:u.washing})),traps:e.state.traps.length};},id);
  if(id==='sprinkler')assert.equal(after.sprinkler,true);else assert.ok(after.cooldown>0,id+' real touch cast');
  if(id==='washer')assert.ok(after.units[0].washing>0);
  if(id==='clay')assert.notEqual(after.units[0].kind,before.kind);
  if(id==='milk_bottle')assert.equal(after.units[0].level,2);
  if(id==='recycle_bin'){assert.equal(after.units.length,0);assert.equal(after.food,before.food+5);}
  if(id==='catnip')assert.ok(after.catnip>0);
  if(id==='expired_can')assert.equal(Math.abs(after.oranges-before.oranges),1);
  if(id==='glue_trap')assert.equal(after.traps,1);
  checks.push(id+': native Chromium touch drag, outside cancel and valid release');
 }
 await fixture('milk_bottle');await act('prop:milk_bottle');await tap(432,228);
 assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units[0].level),2);
 await fixture('catnip');await act('prop:catnip');assert.ok(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.catnipTime>0));
 checks.push('Click-select unit prop plus canvas tap and one-click self prop remain functional');
 await fixture('milk_bottle');await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.state.sides.player.loadout.equippedPassiveProps=[];});await page.waitForTimeout(150);
 assert.equal(await page.locator('#passive-rail .passive-empty').count(),6);await act('passive-backpack');
 assert.equal(await page.locator('[data-action="meta-tab:backpack"]').getAttribute('aria-selected'),'true');await act('close-meta');
 await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.state.spawned=1;});await page.waitForTimeout(150);assert.equal(await page.locator('#passive-rail .passive-empty').count(),0);
 checks.push('Empty prep passive slot opens Backpack; empty slots disappear after spawning');
 await seedProfile(true);const initialCoins=await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins);
 await act('start');await page.locator('#battle-transition').waitFor({state:'hidden'});
 const hold=await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;const before=e.state.waveTime;e.tick(15);return{before,after:e.state.waveTime,spawned:e.state.spawned};});
 assert.equal(hold.before,hold.after);assert.equal(hold.spawned,0);assert.equal(await page.locator('.tutorial-bubble').getAttribute('data-tutorial-step'),'1');
 await act('summon');
 assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.map(u=>u.kind)),['hamster','hamster','panda','hat_bamboo','squirrel']);
 for(const expected of [2,3,4,4]){
  assert.equal(await page.locator('.tutorial-bubble').getAttribute('data-tutorial-step'),String(expected));
  const target=await page.evaluate(async step=>{const{tutorialTargets}=await import('/src/ui/TutorialView.ts');return tutorialTargets(step,window.__CAPY_DEBUG__.engine.state);},expected);
  assert.ok(target.source&&target.target);await tap(target.source.x+target.source.w/2,target.source.y+target.source.h/2);await tap(target.target.x+target.target.w/2,target.target.y+target.target.h/2);
 }
 assert.equal(await page.locator('.tutorial-bubble').getAttribute('data-tutorial-step'),'5');
 await page.locator('#battle-hud [data-action="recipes"]').click();await page.waitForTimeout(120);
 assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.tutorialCompleted),true);await act('close-recipes');
 await page.locator('#early-wave-coachmark:not([hidden])').waitFor();
 await page.waitForTimeout(150);
 const coachingOverlap=await page.evaluate(()=>{const a=document.querySelector('.early-tip-bubble').getBoundingClientRect(),toast=document.querySelector('#toast'),b=toast.getBoundingClientRect();return !toast.hidden&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});
 assert.equal(coachingOverlap,false,'tutorial reward toast must not cover the new early-wave coachmark');
 await page.screenshot({path:path.join(out,'p13-tutorial-complete-early-tip.png')});
 assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),initialCoins+20);
 const early=await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;return{food:e.state.sides.player.food,preview:e.canCallEarlyWave()};});
 await page.locator('#early-wave-coachmark [data-action="early-wave"]').click();await page.waitForTimeout(100);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
 assert.equal(stored.earlyWaveTipSeen,true);assert.equal(stored.tutorialCompleted,true);assert.equal(stored.coins,initialCoins+20);
 assert.ok(await page.evaluate(food=>window.__CAPY_DEBUG__.engine.state.sides.player.food>food,early.food));
 await act('pause');await act('settings');await act('tutorial-replay');await page.locator('#battle-transition').waitFor({state:'hidden'});
 assert.equal(await page.locator('.tutorial-bubble').getAttribute('data-tutorial-step'),'1');assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.earlyWaveTipSeen),false);
 await act('summon');assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.map(u=>u.kind)),['hamster','hamster','panda','hat_bamboo','squirrel']);
 assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),initialCoins+20);
 checks.push('Real five-step tutorial + on-board hero + compendium + new early coach reward; replay resets flag and restores fixed pack without repeat coins');
 assert.deepEqual(errors,[]);
}catch(e){failure=e;console.error(e);await page.screenshot({path:path.join(out,'p13-edge-last-failure.png')});}
finally{await browser.close();fs.writeFileSync(path.join(out,'p13-edge-report.json'),JSON.stringify({passed:!failure,errors,checks,failure:failure?.stack},null,2));}
if(failure)process.exitCode=1;else console.log(JSON.stringify({passed:true,checks:checks.length,errors:errors.length}));
