import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(temp,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',
  env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[],checks=[],screenshots=[],combat=[];let failure=null;
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const mark=text=>{checks.push(text);console.log('PASS '+text);};
const click=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().click();
const settle=()=>page.waitForTimeout(180);
const snap=async name=>{const file=`p2-${name}.png`;await page.screenshot({path:path.join(output,file)});screenshots.push(file);};
const board=(col,row)=>[32+(col+.5)*96,188+(row+.5)*96];
const nest=slot=>[48+slot*112+48,992];
async function point(x,y){const r=await page.locator('#battle-canvas').boundingBox();return{x:r.x+x*r.width/640,y:r.y+y*r.height/1216};}
async function tap(x,y){const p=await point(x,y);await page.mouse.click(p.x,p.y);await settle();}
async function drag(from,to){const a=await point(...from),b=await point(...to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await settle();}
async function fit(){
  const g=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,stage:document.querySelector('#stage').getBoundingClientRect().toJSON(),
    toast:document.querySelector('#toast').getClientRects().length?document.querySelector('#toast').getBoundingClientRect().toJSON():null,
    buttons:[...document.querySelectorAll('#battle-actions button,#sprinkler-button,.battle-prop')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().toJSON())}));
  assert.ok(g.sw<=g.w+1&&g.sh<=g.h+1,JSON.stringify(g));assert.ok(g.stage.bottom<=g.h,JSON.stringify(g));
  assert.ok(Math.abs(g.stage.width/g.stage.height-640/1216)<.001,JSON.stringify(g));
  for(const b of g.buttons){
    assert.ok(b.x>=0&&b.y>=0&&b.right<=g.w+1&&b.bottom<=g.h+1,JSON.stringify(b));
    if(g.toast)assert.ok(g.toast.right<=b.x||g.toast.x>=b.right||g.toast.bottom<=b.y||g.toast.y>=b.bottom,'Toast overlaps battle action: '+JSON.stringify({toast:g.toast,button:b}));
  }
}
async function clearFixture(){
  await page.keyboard.press('Escape');
  await page.evaluate(async()=>{
    const e=window.__CAPY_DEBUG__.engine,{GridSystem}=await import('/src/core/GridSystem.ts');
    e.options.autoWaves=false;e.state.units=[];e.state.enemies=[];e.state.events=[];e.state.craterHits={};e.state.grid=GridSystem.create(e.state.mapId);
    e.state.sides.player.shovels=1;e.state.sides.player.shovelTimer=0;
  });
}
async function grantShovel(){return page.evaluate(()=>window.__CAPY_DEBUG__.engine.grant('shovel').unitId);}
async function fixture(map){
  return page.evaluate(async mapId=>{
    const debug=window.__CAPY_DEBUG__,{getMap}=await import('/src/config/maps.ts'),{WEAPONS}=await import('/src/config/weapons.ts');
    debug.profile.highestStars=180;debug.profile.selectedMap=mapId;debug.profile.tutorialCompleted=true;debug.start();
    const e=debug.engine;e.options.autoWaves=false;e.state.units=[];e.state.enemies=[];e.state.events=[];
    e.state.wave=3;e.state.waveTime=14;e.state.spawned=11;e.state.nextSpawn=1;
    const own=e.state.sides.player;own.food=37;own.summons=2;own.shovels=1;
    own.loadout.equippedWeapons=Object.fromEntries(Object.values(WEAPONS).filter(w=>w.signatureHero).map(w=>[w.signatureHero,w.id]));
    const opens=e.state.grid.flatMap((row,r)=>row.flatMap((tile,c)=>tile==='O'?[{col:c,row:r}]:[]));
    const kinds=['kungfu_po','corgi','bamboo_mafia','squirrel','puss_in_hat','pepe_king'];
    kinds.forEach((kind,i)=>{const result=e.grant(kind);if(!e.move(result.unitId,{zone:'board',...opens[i]}).ok)throw Error('Cannot deploy fixture '+kind);});
    e.grant('shovel');e.grant('hat_bamboo');e.grant('hamster');e.grant('squirrel');e.grant('shovel');
    const route=getMap(mapId).paths.player;
    for(let i=1;i<route.length-2;i++){
      const enemy=e.spawnEnemy(i%4===0?'crab':'rat','player');enemy.hp=enemy.maxHp=5000;enemy.speed=0;enemy.progress=i;Object.assign(enemy,route[i]);
    }
    e.tick(.12);const evidence={mapId,units:e.state.units.filter(u=>u.location.zone==='board').map(u=>({kind:u.kind,attackAnim:u.attackAnim,facing:u.facing,attackAngle:u.attackAngle})),events:e.state.events.map(v=>({type:v.type,effect:v.effect,age:v.age})),aiUnits:e.state.units.filter(u=>u.side==='ai').length,aiEnemies:e.state.enemies.filter(m=>m.side==='ai').length};
    // Freeze a real simulated attack frame, without fabricating any combat event.
    e.tick=()=>{};return evidence;
  },map);
}

try{
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>typeof window.__CAPY_DEBUG__),'object','Use the Vite development server for P2 interaction fixtures');
  await fit();assert.equal(await page.locator('.sandbox-column').isVisible(),false);await snap('mobile-menu');
  await click('start');await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.options.autoWaves=false;});
  await fit();assert.equal(await page.locator('#opponent-banner').count(),0);
  assert.deepEqual(await page.evaluate(()=>{const s=window.__CAPY_DEBUG__.engine.state;return[s.grid.length,s.grid[0].length,s.sides.player.food,s.sides.player.shovels,s.sides.player.summons];}),[7,6,22,1,0]);
  await snap('mobile-tutorial');await click('en');await settle();await fit();await snap('mobile-tutorial-en');await click('zh-CN');
  await click('summon');await settle();
  assert.match(await page.locator('#summon-note').innerText(),/12/);
  const first=await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;const unit=e.state.units.find(u=>u.kind!=='shovel');const target=e.state.grid.flatMap((row,r)=>row.flatMap((tile,c)=>tile==='O'?[{col:c,row:r}]:[]))[0];return{slot:unit.location.slot,target};});
  await drag(nest(first.slot),board(first.target.col,first.target.row));await click('tutorial-ack');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),20);
  await click('summon');await settle();assert.match(await page.locator('#summon-note').innerText(),/14/);assert.equal(await page.locator('#food-value').innerText(),'0');
  const pack=await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.filter(u=>u.location.zone==='bench').map(u=>[u.id,u.kind]));
  assert.ok(pack.filter(([,kind])=>kind==='shovel').length<=2);
  await click('summon');assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.filter(u=>u.location.zone==='bench').map(u=>[u.id,u.kind])),pack);
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.summons),2);
  assert.doesNotMatch(await page.locator('#toast').innerText(),/hint\.|p1\./);
  mark('Solo6×7 clean mobile, initial22/1, real tutorial deployment, cost10→12→14 and failed-redraw atomicity');

  await clearFixture();const digId=await grantShovel();await drag(nest(0),board(0,1));
  assert.deepEqual(await page.evaluate(id=>{const e=window.__CAPY_DEBUG__.engine;return[e.state.grid[1][0],e.state.units.some(u=>u.id===id),e.state.sides.player.shovels];},digId),['O',false,1]);
  await grantShovel();await tap(...nest(0));await tap(...board(5,0));assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.grid[0][5]),'O');
  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.grid[3][2]='B';e.grant('shovel');e.grant('shovel');});
  await tap(...nest(0));await tap(...board(2,3));assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.craterHits['2,3']),1);await snap('mobile-repair-half');
  await drag(nest(1),board(2,3));assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.grid[3][2]),'O');
  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.grid[3][2]='B';e.state.sides.player.shovels=1;});
  await tap(556,898);await tap(...board(2,3));assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.craterHits['2,3']),1);
  await grantShovel();await drag(nest(0),board(2,3));assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.grid[3][2]),'O');
  await grantShovel();await tap(...nest(0));await tap(556,898);assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.shovels),1);
  await grantShovel();await drag(nest(0),[556,898]);assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.shovels),2);
  const fullId=await grantShovel();await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.shovels=e.getShovelRules().maxStored;});
  await drag(nest(0),[556,898]);assert.ok(await page.evaluate(id=>window.__CAPY_DEBUG__.engine.state.units.some(u=>u.id===id),fullId));
  assert.doesNotMatch(await page.locator('#toast').innerText(),/hint\./);
  await page.evaluate(()=>window.__CAPY_DEBUG__.engine.grant('hamster'));await drag(nest(0),nest(1));
  assert.equal(await page.evaluate(id=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.id===id).location.slot,fullId),1);
  await fit();mark('Mouse drag/click bench shovel digs, staged bench+pouch repair, storage/full rejection and nest swaps work');

  await clearFixture();await grantShovel();const touchFrom=await point(...nest(0)),touchTo=await point(...board(0,1));
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchFrom.x,y:touchFrom.y}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchFrom.x+(touchTo.x-touchFrom.x)*i/8,y:touchFrom.y+(touchTo.y-touchFrom.y)*i/8}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await settle();
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.grid[1][0]),'O');assert.equal(await page.evaluate(()=>scrollY),0);
  mark('Real touch shovel drag digs the intended tile without page scroll');

  for(const map of ['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze']){
    const evidence=await fixture(map);combat.push(evidence);await settle();await fit();await snap(`mobile-${map}`);
    assert.equal(evidence.aiUnits,0);assert.equal(evidence.aiEnemies,0);
    assert.ok(evidence.events.some(e=>e.type==='slash'&&e.effect==='spin360'),JSON.stringify(evidence));
    assert.ok(evidence.events.some(e=>e.type==='projectile'),JSON.stringify(evidence));
    assert.ok(evidence.units.some(u=>u.attackAnim>0));
    if(map==='sunny_backyard'){
      await page.setViewportSize({width:1440,height:900});await settle();await fit();await snap('desktop-combat');
      await page.setViewportSize({width:1024,height:900});await settle();await fit();await snap('tablet-desktop-combat');
      await page.setViewportSize({width:800,height:900});await settle();await fit();await snap('narrow-desktop-combat');
      await page.setViewportSize({width:390,height:844});await settle();
    }
  }
  mark('All four6×7 maps show real mid-swing mounted weapons, spin slash, ranged projectiles, bench shovels and cost14');
  await fixture('sunny_backyard');
  const feedback=await page.evaluate(()=>{
    const e=window.__CAPY_DEBUG__.engine;delete e.tick;e.state.events=[];
    for(const u of e.state.units)u.cooldown=0;
    for(const m of e.state.enemies)m.hp=1;
    const food=e.state.sides.player.food;e.tick(.1);e.tick=()=>{};
    return{gained:e.state.sides.player.food-food,events:e.state.events.map(v=>({type:v.type,value:v.value}))};
  });
  assert.ok(feedback.gained>0&&feedback.events.some(e=>e.type==='death')&&feedback.events.some(e=>e.type==='food'&&e.value===1));
  await settle();await snap('mobile-hit-food-feedback');mark('Real kills produce comic death dust and +1food visual events');
  await click('en');await settle();await fit();await snap('mobile-combat-en');
  const visible=await page.locator('.center-column').innerText();assert.doesNotMatch(visible,/hint\.[\w.]+|p1\.[\w.]+|render\.[\w.]+/);
  await click('recipes');
  for(const [tab,count]of Object.entries({heroes:12,bosses:12,weapons:36,props:20})){
    await click(`book:${tab}`);assert.equal(await page.locator('[data-entry]').count(),count);
    assert.doesNotMatch(await page.locator('#book-content').innerText(),/[\u3400-\u9fff]|hint\.[\w.]+|p1\.[\w.]+/);
  }
  await click('close-recipes');await click('zh-CN');
  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.spawnEnemy('box_kraken','player');});await settle();
  assert.equal(await page.locator('#boss-banner').isVisible(),true);await snap('mobile-boss');
  await click('pause');assert.equal(await page.locator('.loot-columns > section').count(),1);
  assert.doesNotMatch(await page.locator('#game-dialog').innerText(),/对手|双方|Opponent|Both gardens/);
  await click('surrender');assert.doesNotMatch(await page.locator('#game-dialog').innerText(),/对手|双方|Opponent|Both gardens/);
  await click('menu');
  mark('Solo pause/result, Boss HUD and all80 bilingual encyclopedia entries remain functional');
  await page.setViewportSize({width:1440,height:900});
  await click('settings');await page.locator('[data-setting="developerMode"]').check();await click('close-profile');
  await click('start');await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.options.autoWaves=false;});
  await page.locator('#dev-boss').selectOption('husky_wrecker');await click('boss');
  assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.enemies.map(m=>[m.kind,m.side])),[['husky_wrecker','player']]);
  await page.locator('#dev-unit').selectOption('shovel');await click('grant');
  assert.ok(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.some(u=>u.kind==='shovel')));
  await click('settings');await page.locator('[data-setting="developerMode"]').uncheck();await click('close-profile');await settle();await fit();
  await snap('desktop-clean-boss');mark('Developer grant includes shovels and Boss button creates exactly one player-lane Boss');
  // Complete a controlled final-wave fixture through the normal engine and UI award path.
  const settlement=await page.evaluate(async()=>{
    const debug=window.__CAPY_DEBUG__,{RANKS}=await import('/src/config/ranks.ts');
    debug.start();const e=debug.engine,before=structuredClone(debug.profile);
    e.state.wave=10;e.state.waveTime=30;e.state.spawned=26;e.state.enemies=[];e.state.units=[];
    e.state.sides.player.food=100;e.state.sides.player.loot=['m01_swatter'];e.state.sides.ai.loot=['r01_rubber_band'];
    e.options.autoWaves=true;e.tick(.05);
    return{before,result:e.state.result,expectedCoins:RANKS[e.state.rankIndex].winCoins+45};
  });
  await page.locator('#game-dialog [data-action="menu"]').waitFor();
  assert.equal(settlement.result.winner,'player');assert.equal(settlement.result.coins,settlement.expectedCoins);
  assert.deepEqual(settlement.result.loot,['m01_swatter']);
  const awarded=await page.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
  assert.equal(awarded.wins,settlement.before.wins+1);assert.equal(awarded.coins,settlement.before.coins+settlement.expectedCoins);
  assert.equal(awarded.freeLotteryTickets,settlement.before.freeLotteryTickets+1);assert.ok(awarded.stars>settlement.before.stars);
  assert.equal(awarded.weaponFragments.m01_swatter,(settlement.before.weaponFragments.m01_swatter??0)+1);
  assert.equal(awarded.weaponFragments.r01_rubber_band,settlement.before.weaponFragments.r01_rubber_band);
  assert.ok(awarded.unlockedWeapons.includes('m01_swatter'));await snap('desktop-victory');
  await click('menu');await page.reload({waitUntil:'networkidle'});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile'))),awarded);
  mark('Final-wave clearance awards only player loot, capped food coins, stars and one ticket; receipt survives reload without duplication');
  const fallbackContext=await browser.newContext({viewport:{width:390,height:844}}),fallback=await fallbackContext.newPage();
  fallback.on('pageerror',error=>errors.push(error.message));fallback.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await fallback.route('**/sprites/manifest.json',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await fallback.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await fallback.locator('[data-action="start"]').click();
  await fallback.locator('[data-action="tutorial-skip"]').click();
  const fallbackEvents=await fallback.evaluate(()=>{
    const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;
    for(const [kind,col,row]of [['corgi',1,1],['squirrel',2,1]]){const u=e.grant(kind);e.move(u.unitId,{zone:'board',col,row});}
    for(let progress=1;progress<=3;progress++){const m=e.spawnEnemy('rat','player');m.hp=m.maxHp=999;m.speed=0;m.progress=progress;m.col=progress;}
    e.grant('shovel');e.tick(.12);e.tick=()=>{};return e.state.events.map(v=>v.type);
  });
  assert.ok(fallbackEvents.includes('slash')&&fallbackEvents.includes('projectile'));
  await fallback.waitForTimeout(200);await fallback.screenshot({path:path.join(output,'p2-mobile-fallback.png')});screenshots.push('p2-mobile-fallback.png');
  await fallbackContext.close();mark('Absent optional images retain playable solo board, held weapons, slash/projectile fallback and bench shovel');
  assert.deepEqual(errors,[]);mark('Console/pageerror:0');
}catch(error){
  failure=String(error.stack??error);
  await page.screenshot({path:path.join(output,'p2-browser-failure.png')}).catch(()=>{});
  throw error;
}finally{
  fs.writeFileSync(path.join(output,'p2-browser-report.json'),JSON.stringify({passed:failure===null&&errors.length===0,checks,errors,screenshots,combat,failure},null,2));await browser.close();
}
