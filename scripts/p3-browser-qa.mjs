import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(temp,{recursive:true});
process.env.TEMP=temp;process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',
  env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:true});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[],checks=[],screenshots=[],combat=[];let failure=null;
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const mark=text=>{checks.push(text);console.log('PASS '+text);};
const click=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().click();
const settle=()=>page.waitForTimeout(200);
const snap=async name=>{const file=`p3-${name}.png`;await page.screenshot({path:path.join(output,file)});screenshots.push(file);};
const board=(col,row)=>[172+(col+.5)*104,72+(row+.5)*104];
const nest=slot=>[252+slot*104+46,656];
async function point(x,y){const r=await page.locator('#battle-canvas').boundingBox();return{x:r.x+x*r.width/1280,y:r.y+y*r.height/720};}
async function tap(x,y){const p=await point(x,y);await page.mouse.click(p.x,p.y);await settle();}
async function drag(from,to){const a=await point(...from),b=await point(...to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await settle();}
async function fit(){
  const g=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
    stage:document.querySelector('#stage').getBoundingClientRect().toJSON(),buttons:[...document.querySelectorAll('#battle-actions button,#sprinkler-button,.battle-prop,.control-dock button')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().toJSON())}));
  assert.ok(g.sw<=g.w+1&&g.sh<=g.h+1,JSON.stringify(g));
  assert.ok(g.stage.left>=-.5&&g.stage.top>=-.5&&g.stage.right<=g.w+1&&g.stage.bottom<=g.h+1,JSON.stringify(g));
  assert.ok(Math.abs(g.stage.width/g.stage.height-16/9)<.005,JSON.stringify(g));
  for(const b of g.buttons)assert.ok(b.x>=g.stage.x-1&&b.y>=g.stage.y-1&&b.right<=g.stage.right+1&&b.bottom<=g.stage.bottom+1,JSON.stringify(b));
  const docks=await page.evaluate(()=>{const boss=document.querySelector('#boss-banner');return boss?.getClientRects().length?{boss:boss.getBoundingClientRect().toJSON(),control:document.querySelector('.control-dock').getBoundingClientRect().toJSON(),resource:document.querySelector('.resource-dock').getBoundingClientRect().toJSON()}:null;});
  const overlaps=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
  if(docks)assert.ok(!overlaps(docks.resource,docks.boss)&&!overlaps(docks.boss,docks.control),JSON.stringify(docks));
}
async function fixture(mapId='sunny_backyard',targetPage=page){
  return targetPage.evaluate(async map=>{
    const debug=window.__CAPY_DEBUG__,{getMap}=await import('/src/config/maps.ts'),{WEAPONS}=await import('/src/config/weapons.ts');
    debug.profile.highestStars=180;debug.profile.selectedMap=map;debug.profile.tutorialCompleted=true;debug.start();
    const e=debug.engine;e.options.autoWaves=false;e.state.units=[];e.state.enemies=[];e.state.events=[];
    e.state.wave=3;e.state.waveTime=14;e.state.spawned=11;e.state.nextSpawn=1;
    const own=e.state.sides.player;own.food=37;own.summons=2;own.shovels=1;
    own.loadout.equippedWeapons=Object.fromEntries(Object.values(WEAPONS).filter(w=>w.signatureHero).map(w=>[w.signatureHero,w.id]));
    const opens=e.state.grid.flatMap((row,r)=>row.flatMap((tile,c)=>tile==='O'?[{col:c,row:r}]:[]));
    ['kungfu_po','corgi','bamboo_mafia','squirrel','puss_in_hat','pepe_king'].forEach((kind,i)=>{
      const result=e.grant(kind);if(!e.move(result.unitId,{zone:'board',...opens[i]}).ok)throw Error('Cannot deploy '+kind);
    });
    ['shovel','panda','hat_bamboo','hamster','shovel'].forEach(kind=>e.grant(kind));
    const route=getMap(map).paths.player;
    for(let i=1;i<route.length-2;i+=2){
      const enemy=e.spawnEnemy(i===9?'husky_wrecker':i%3===0?'roach':'rat','player');
      enemy.hp=enemy.maxHp=10000;enemy.speed=.2;enemy.progress=i;Object.assign(enemy,route[i]);
    }
    e.tick(.12);
    const evidence={map,unitAttacks:e.state.units.filter(u=>u.attackAnim>0).map(u=>u.kind),events:e.state.events.map(v=>v.type),
      enemies:e.state.enemies.map(m=>({kind:m.kind,progress:m.progress,col:m.col,row:m.row})),aiUnits:e.state.units.filter(u=>u.side==='ai').length};
    e.tick=()=>{};return evidence;
  },mapId);
}
async function language(code){
  const direct=page.locator(`[data-action="${code}"]`).filter({visible:true});
  if(await direct.count()){await direct.first().click();return;}
  await click('pause');await click(code);await click('resume');
}
async function noRawKeys(){
  const visible=await page.locator('body').innerText();
  assert.doesNotMatch(visible,/\b(?:hint|p1|p3|m2|m3|render|inspect|recipe)\.[a-zA-Z][\w.]*/);
}
const dialogText=()=>page.locator('#game-dialog').evaluate(el=>{const copy=el.cloneNode(true);copy.querySelector('.dialog-language')?.remove();return copy.textContent;});
async function preparationShop(){
  // This browser context has an isolated save. Seed ownership, then exercise real UI transactions.
  await page.evaluate(async()=>{
    const {createProfile,unlockAllProfile}=await import('/src/core/MetaProgression.ts');
    const p=unlockAllProfile(createProfile());p.equippedActiveProps=[];p.equippedPassiveProps=[];p.equippedWeapons={};
    delete p.ownedProps.milk_bottle;delete p.ownedProps.catnip;
    const d=new Date();p.shop={day:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,offers:['milk_bottle','catnip']};
    localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(p));
  });
  await page.reload({waitUntil:'networkidle'});
  for(const map of ['sakura_onsen','midnight_kitchen','cat_tower_maze','sunny_backyard']){
    await click(`select-map:${map}`);await settle();
    assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.selectedMap),map);
    assert.equal(await page.locator(`[data-action="select-map:${map}"]`).getAttribute('aria-pressed'),'true');
    if(map==='sakura_onsen')await snap('menu-sakura');
  }
  mark('Unlocked map chips persist selection and refresh live scenic courtyard');
  await click('start');
  await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.options.autoWaves=false;});
  await page.locator('#battle-props [data-action="battle-shop"]').first().click();
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.phase),'paused');
  await click('battle-shop:armory');
  await click('meta-equip:m01_swatter:kungfu_po');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.loadout.equippedWeapons.kungfu_po),'m01_swatter');
  await click('battle-shop:market');
  await click('meta-buy:milk_bottle');await click('meta-prop:milk_bottle');
  await click('meta-prop:extra_oranges');await click('meta-prop:auto_shovel');
  assert.deepEqual(await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine,s=e.state.sides.player;return[s.loadout.equippedActiveProps,s.oranges,e.getShovelRules()];}),[['milk_bottle'],5,{interval:30,maxStored:6}]);
  await snap('preparation-shop');await click('close-meta');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.phase),'playing');
  mark('Real preparation shop weapon equip, prop purchase/equip and passive effects sync immediately');

  await page.evaluate(()=>window.__CAPY_DEBUG__.engine.pause(true));await click('battle-shop');await click('close-meta');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.phase),'paused');
  await page.evaluate(()=>window.__CAPY_DEBUG__.engine.pause(false));
  await click('battle-shop');await click('battle-shop:armory');
  const saved=await page.evaluate(()=>({profile:structuredClone(window.__CAPY_DEBUG__.profile),loadout:structuredClone(window.__CAPY_DEBUG__.engine.state.sides.player.loadout)}));
  await page.evaluate(()=>{window.__originalStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='capybara_defense_v1:profile')throw Error('QA storage unavailable');return window.__originalStorageWrite.call(this,key,value);};});
  try{
    await click('meta-equip:m02_slipper:kungfu_po');
    assert.deepEqual(await page.evaluate(()=>({profile:window.__CAPY_DEBUG__.profile,loadout:window.__CAPY_DEBUG__.engine.state.sides.player.loadout})),saved);
  }finally{await page.evaluate(()=>{Storage.prototype.setItem=window.__originalStorageWrite;delete window.__originalStorageWrite;});}
  await click('close-meta');
  mark('Shop preserves previous pause state; failed profile persistence leaves profile and active loadout unchanged');

  await page.evaluate(()=>window.__CAPY_DEBUG__.engine.spawnEnemy('rat','player'));
  const frozen=await page.evaluate(()=>structuredClone(window.__CAPY_DEBUG__.engine.state.sides.player.loadout));
  await click('battle-shop');await click('battle-shop:armory');await click('meta-equip:m02_slipper:kungfu_po');
  assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.loadout),frozen);
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedWeapons.kungfu_po),'m02_slipper');
  await click('battle-shop:market');await click('meta-buy:catnip');await click('meta-prop:catnip');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.ownedProps.catnip),1);
  assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.loadout),frozen);
  await click('en');assert.doesNotMatch(await dialogText(),/[\u3400-\u9fff]/);await noRawKeys();await click('zh-CN');
  await snap('locked-battle-shop');await click('close-meta');
  mark('First enemy permanently locks active battle loadout while profile changes remain available for next battle');
}
async function mobileTouch(){
  const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const p=await mobile.newPage();
  p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  try{
    await p.addInitScript(()=>localStorage.setItem('capybara_defense_v1:profile',JSON.stringify({tutorialCompleted:true})));
    await p.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
    await p.locator('[data-action="start"]').tap();
    await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.state.units=[];e.grant('shovel');});
    const rect=await p.locator('#battle-canvas').boundingBox();
    const px=([x,y])=>({x:rect.x+x*rect.width/1280,y:rect.y+y*rect.height/720});
    const from=px(nest(0)),to=px(board(2,0)),cdp=await mobile.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.grid[0][2]),'O');
    assert.equal(await p.evaluate(()=>scrollY),0);
    await fixture('sunny_backyard',p);await p.waitForTimeout(200);
    const at=px(nest(1));await p.touchscreen.tap(at.x,at.y);
    assert.ok(await p.locator('#live-unit-card').isVisible());
    const sizes=await p.evaluate(()=>({card:parseFloat(getComputedStyle(document.querySelector('#live-unit-card')).fontSize),stat:parseFloat(getComputedStyle(document.querySelector('[data-live-stat="damage"]')).fontSize)}));
    assert.ok(sizes.card>=12&&sizes.stat>=14,JSON.stringify(sizes));
    await p.locator('#toast').waitFor({state:'hidden'});
    await p.screenshot({path:path.join(output,'p3-mobile-landscape.png')});
    await p.locator('#live-unit-card [data-action="clear"]').tap();
    const hero=await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.kind==='kungfu_po').location);
    const heroPoint=px(board(hero.col,hero.row));await p.touchscreen.tap(heroPoint.x,heroPoint.y);
    const card=await p.locator('#live-unit-card').boundingBox();
    assert.ok(await p.locator('#live-unit-card').evaluate(el=>el.scrollHeight>el.clientHeight),'Hero details exercise an overflowing card');
    const scrollTouch=await mobile.newCDPSession(p),x=card.x+card.width*.65,y=card.y+card.height-18;
    await scrollTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=8;i++){await scrollTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*12}]});await p.waitForTimeout(16);}
    await scrollTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await scrollTouch.detach();
    assert.ok(await p.locator('#live-unit-card').evaluate(el=>el.scrollTop>0),'Touch swiping scrolls overflowing unit details');
    assert.equal(await p.evaluate(()=>scrollY),0);
    mark('Real mobile context844×390: touch drag digs, unit card opens and its details scroll without page movement');
    await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);
    const portrait=await p.evaluate(()=>{const card=document.querySelector('#live-unit-card'),stage=document.querySelector('#stage'),close=card.querySelector('[data-action="clear"]');return{card:card.getBoundingClientRect().toJSON(),stage:stage.getBoundingClientRect().toJSON(),bodyFont:parseFloat(getComputedStyle(card).fontSize),statFont:parseFloat(getComputedStyle(card.querySelector('[data-live-stat="damage"]')).fontSize),close:close.getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight};});
    assert.ok(portrait.bodyFont>=12&&portrait.statFont>=14,JSON.stringify(portrait));
    assert.ok(portrait.close.width>=30&&portrait.close.height>=30,JSON.stringify(portrait));
    assert.ok(portrait.card.y>=portrait.stage.bottom&&portrait.card.bottom<=portrait.height&&portrait.card.x>=0&&portrait.card.right<=portrait.width,JSON.stringify(portrait));
    assert.ok(portrait.scrollHeight<=portrait.height+1);
    await p.locator('#live-unit-card').evaluate(el=>{el.scrollTop=0;});
    await p.screenshot({path:path.join(output,'p3-mobile-portrait.png')});
    await p.locator('#live-unit-card [data-action="inspect-book:kungfu_po"]').tap();
    assert.ok(await p.locator('[data-compendium-focused="true"]').isVisible());
    await p.locator('[data-action="book:pets"]').tap();
    await p.screenshot({path:path.join(output,'p3-portrait-compendium.png')});
    await p.locator('[data-action="close-recipes"]').tap();
    await p.locator('#live-unit-card [data-action="clear"]').tap();
    assert.equal(await p.locator('#live-unit-card').count(),0);
    const portraitCanvas=await p.locator('#battle-canvas').boundingBox(),selected=nest(1);
    await p.touchscreen.tap(portraitCanvas.x+selected[0]*portraitCanvas.width/1280,portraitCanvas.y+selected[1]*portraitCanvas.height/720);
    assert.ok(await p.locator('#live-unit-card').isVisible());
    mark('Real portrait390×844: readable letterbox unit card, touch book/close/reselect, unobstructed stage and no page scroll');
  }finally{await mobile.close();}
}
async function fallbackAndDrawer(){
  await page.route('**/sprites/manifest.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('http://127.0.0.1:4175/?dev=1',{waitUntil:'networkidle'});
  assert.ok(await page.locator('.sandbox-column').isVisible());
  const before=await page.locator('#stage').boundingBox();
  await page.locator('#dev-tools > summary').click();
  assert.deepEqual(await page.locator('#stage').boundingBox(),before);
  await page.locator('#dev-tools > summary').click();
  await click('start');await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.options.autoWaves=false;});
  assert.ok(await page.locator('#summon-button .bell svg').isVisible());
  await click('summon');await fit();await snap('fallback-developer');
  mark('Missing optional art falls back to illustrated icons and procedural map; developer drawer never resizes stage');
}

try{
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>typeof window.__CAPY_DEBUG__),'object','Use Vite development server for interaction fixtures');
  await fit();await snap('landscape-menu');assert.equal(await page.locator('.sandbox-column').isVisible(),false);
  await click('start');await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.options.autoWaves=false;});
  assert.deepEqual(await page.evaluate(()=>{const s=window.__CAPY_DEBUG__.engine.state;return[s.grid.length,s.grid[0].length,s.sides.player.food,s.sides.player.shovels];}),[5,9,22,1]);
  const spotlight=await page.locator('.tutorial-spotlight').boundingBox(),summon=await page.locator('#summon-button').boundingBox();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(spotlight[key]-summon[key])<3,`Tutorial summon ${key}: ${spotlight[key]} vs ${summon[key]}`);
  await snap('landscape-tutorial');
  await click('tutorial-skip');await click('summon');
  assert.match(await page.locator('#summon-button').innerText(),/12/);
  await click('summon');assert.match(await page.locator('#summon-button').innerText(),/14/);
  assert.equal(await page.locator('#food-value').innerText(),'0');
  const pack=await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.filter(u=>u.location.zone==='bench').map(u=>[u.id,u.kind]));
  await click('summon');assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.filter(u=>u.location.zone==='bench').map(u=>[u.id,u.kind])),pack);
  await fit();mark('Landscape9×5 clean stage; P2 initial22/1 and costs10→12→14 remain transactional');

  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.units=[];e.grant('shovel');});
  await drag(nest(0),board(2,0));assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.grid[0][2]),'O');
  await page.evaluate(()=>window.__CAPY_DEBUG__.engine.grant('shovel'));await tap(...nest(0));
  assert.ok(await page.locator('#live-unit-card').isVisible());await click('store-shovel');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.shovels),2);
  mark('New landscape pointer coordinates dig grass and live shovel card stores into pouch');

  for(const map of ['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze']){
    const evidence=await fixture(map);combat.push(evidence);await settle();await tap(...nest(1));
    assert.equal(evidence.aiUnits,0);assert.ok(evidence.unitAttacks.length>0);
    assert.ok(evidence.events.includes('slash')&&evidence.events.includes('projectile'));
    assert.ok(await page.locator('#live-unit-card').isVisible());
    assert.match(await page.locator('#live-unit-card').innerText(),/⚔️|⚔/);
    assert.ok(await page.locator('#live-unit-card [data-action="inspect-book:kungfu_po"]').count());
    await fit();await page.locator('#toast').waitFor({state:'hidden'});await snap(map==='sunny_backyard'?'landscape-combat':`map-${map}`);
  }
  mark('All four scenic maps show live held-weapon attacks, larger enemies and component synthesis card');
  await click('inspect-book:kungfu_po');
  assert.ok(await page.locator('[data-compendium-kind="kungfu_po"]').filter({visible:true}).count());
  await click('book:matrix');await settle();await snap('compendium-matrix');
  const title=await page.locator('.ledger-header h2').boundingBox(),dialog=await page.locator('#game-dialog').boundingBox();
  assert.ok(title.y>=dialog.y&&title.y+title.height<=dialog.y+dialog.height,'Switching from a deep-link to matrix resets content scroll');
  for(const tab of ['matrix','pets','heroes','bosses','weapons','props']){await click(`book:${tab}`);await noRawKeys();}
  await click('book:pets');await snap('compendium-pets');await click('close-recipes');
  mark('Six compendium tabs and exact selected-unit deep-link work');

  await page.setViewportSize({width:844,height:390});await fixture();await settle();await tap(...nest(1));await fit();await snap('mobile-landscape');
  await page.setViewportSize({width:390,height:844});await settle();await fit();await snap('mobile-portrait');
  await tap(...nest(3));assert.ok(await page.locator('#live-unit-card').isVisible());
  await click('recipes');await click('book:pets');await noRawKeys();await snap('portrait-compendium');await click('close-recipes');
  await language('en');await fit();await language('zh-CN');
  mark('844×390 landscape and390×844 portrait remain contained and clickable');
  await page.setViewportSize({width:1440,height:900});await language('en');await noRawKeys();await snap('landscape-english');
  await click('recipes');
  for(const tab of ['matrix','pets','heroes','bosses','weapons','props']){
    await click(`book:${tab}`);const text=await dialogText();
    assert.doesNotMatch(text,/[\u3400-\u9fff]/);await noRawKeys();
  }
  await click('close-recipes');mark('English six-tab content has no Chinese leakage or raw translation keys');
  await language('zh-CN');await preparationShop();
  await mobileTouch();
  await fallbackAndDrawer();
  assert.deepEqual(errors,[]);mark('Console/pageerror:0');
}catch(error){failure=String(error.stack??error);throw error;}
finally{
  fs.writeFileSync(path.join(output,'p3-browser-report.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,screenshots,combat,failure},null,2));
  await browser.close();
}
