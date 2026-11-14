import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'.runtime','browser-tmp');fs.mkdirSync(runtime,{recursive:true});
const executablePath=process.env.CAPY_CHROME ?? [
  path.join(process.env.PROGRAMFILES??'C:/Program Files','Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)']??'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
].find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('Set CAPY_CHROME to an installed Chrome/Edge executable.');
const browser=await chromium.launch({headless:true,executablePath,env:{...process.env,TEMP:runtime,TMP:runtime},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const page=await browser.newPage({viewport:{width:1536,height:1200},deviceScaleFactor:1});
page.setDefaultTimeout(10000);
const errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const mark=text=>{checks.push(text);console.log('PASS '+text);};
const click=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().click();
const state=()=>page.evaluate(()=>structuredClone(window.__CAPY_DEBUG__.engine.state));
async function point(x,y){const b=await page.locator('#battle-canvas').boundingBox();return{x:b.x+x/640*b.width,y:b.y+y/1386*b.height};}
async function drag(x1,y1,x2,y2){const a=await point(x1,y1),b=await point(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();await page.waitForTimeout(80);}
async function grant(kind){await page.locator('#dev-unit').selectOption(kind);await click('grant');}
async function boss(kind){await page.locator('#dev-boss').selectOption(kind);await click('boss');}
try{
  await page.goto('http://127.0.0.1:4175/?dev=1',{waitUntil:'networkidle'});
  await page.locator('[data-action="start"]').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  assert.equal(await page.locator('#dev-unit option').count(),19);assert.equal(await page.locator('#dev-boss option').count(),12);
  await page.screenshot({path:path.join(root,'verification','desktop-menu.png'),fullPage:true});mark('Chinese menu, 19 unit options and all 12 bosses');
  await click('start');
  await page.evaluate(()=>{window.__qaPointers=[];document.querySelector('#battle-canvas').addEventListener('pointerup',event=>{const b=event.currentTarget.getBoundingClientRect();window.__qaPointers.push({x:(event.clientX-b.left)/b.width*640,y:(event.clientY-b.top)/b.height*1386,bounds:{x:b.x,y:b.y,width:b.width,height:b.height},scrollY});});});
  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.options.ai=false;e.state.enemies=[];});
  const initial=await state();await click('food');assert.equal((await state()).sides.player.food,initial.sides.player.food+500);
  await click('summon');assert.equal((await state()).sides.player.food,initial.sides.player.food+490);
  assert.equal((await state()).units.filter(u=>u.side==='player'&&u.location.zone==='bench').length,5);
  assert.match(await page.locator('#summon-note').innerText(),/5/);
  await drag(114,1162,212,780);assert.equal((await state()).units.filter(u=>u.side==='player'&&u.location.zone==='board').length,1);mark('Summon spends 10; +500; actual pointer drag deploys');
  const deployedId=(await state()).units.find(u=>u.side==='player'&&u.location.zone==='board').id;
  let discardedIds=(await state()).units.filter(u=>u.side==='player'&&u.location.zone==='bench').map(u=>u.id);
  assert.equal(await page.locator('#summon-title').innerText(),'换一窝');assert.match(await page.locator('#summon-note').innerText(),/4/);
  const beforeRedraw=(await state()).sides.player.food;await click('summon');
  let refreshed=await state();assert.equal(refreshed.sides.player.food,beforeRedraw-10);assert.equal(refreshed.units.filter(u=>u.side==='player'&&u.location.zone==='bench').length,5);
  assert.ok(refreshed.units.some(u=>u.id===deployedId));assert.ok(refreshed.units.every(u=>!discardedIds.includes(u.id)));
  discardedIds=refreshed.units.filter(u=>u.side==='player'&&u.location.zone==='bench').map(u=>u.id);await click('summon');
  assert.ok((await state()).units.every(u=>!discardedIds.includes(u.id)));mark('Partially used and full packs can redraw; deployed pets survive; cost stays 10');
  await click('en');assert.equal(await page.locator('#summon-title').innerText(),'Draw a new pack');await click('zh-CN');
  await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.state.sides.player.food=9;});await page.waitForTimeout(150);
  const keptIds=(await state()).units.map(u=>u.id);assert.ok(await page.locator('#summon-shortage').isVisible());await click('summon');
  assert.deepEqual((await state()).units.map(u=>u.id),keptIds);assert.equal((await state()).sides.player.food,9);mark('Insufficient food preserves every card and shows shortage');await click('food');
  await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.state.units=[];});
  await grant('panda');await grant('hat_bamboo');await drag(114,1162,212,780);await drag(214,1162,212,780);
  let s=await state();assert.equal(s.units.filter(u=>u.side==='player').length,1);assert.equal(s.units[0].kind,'kungfu_po');mark('Cross bench/board recipe creates Kung-Fu Po');
  await boss('box_kraken');assert.ok((await state()).units[0].statuses.SEALED>0);
  await grant('panda');await drag(114,1162,212,780);s=await state();assert.equal(s.units[0].level,2);assert.deepEqual(s.units[0].statuses,{});mark('Feeding purges live Box Kraken seal');
  await boss('sad_rain_frog');assert.ok((await state()).units[0].statuses.WET>0);
  await grant('hat_bamboo');await drag(114,1162,212,780);assert.deepEqual((await state()).units[0].statuses,{});mark('Feeding purges live rain debuff');
  const shovelBefore=(await state()).sides.player.shovels;await drag(550,1035,140,924);assert.equal((await state()).grid[9][1],'O');assert.equal((await state()).sides.player.shovels,shovelBefore-1);mark('Shovel drag opens grass and spends one shovel');
  for(const id of ['husky_wrecker','mega_roomba','dr_clippers','king_skunk'])await boss(id);
  s=await state();for(const id of ['box_kraken','sad_rain_frog','husky_wrecker','mega_roomba','dr_clippers','king_skunk'])assert.equal(s.enemies.filter(m=>m.kind===id).length,2);
  assert.ok(s.sides.player.fog>0);await drag(212,780,284,780);assert.equal((await state()).units[0].location.col,3);mark('All six boss buttons spawn mirrored pairs; fog allows dragging');
  const lives=(await state()).sides.player.oranges;await click('orange-plus');assert.equal((await state()).sides.player.oranges,lives+1);await click('orange-minus');assert.equal((await state()).sides.player.oranges,lives);
  await click('speed-2');assert.equal(await page.locator('#hud-speed').innerText(),'2×');await click('speed-1');assert.equal(await page.locator('#hud-speed').innerText(),'1×');mark('Orange and speed controls change live state');
  const battleId=(await state()).id;await click('en');assert.equal((await state()).id,battleId);assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.match(await page.locator('#summon-title').innerText(),/Ring|Summon|Dinner/i);mark('English hot switch preserves battle');
  await click('pause');const paused=(await state()).time;await page.waitForTimeout(200);assert.equal((await state()).time,paused);
  await page.locator('#game-dialog [data-action="zh-CN"]').click();assert.equal((await state()).phase,'paused');
  await page.screenshot({path:path.join(root,'verification','pause-dialog.png'),fullPage:true});await click('resume');mark('Pause freezes time and supports language switch inside dialog');
  // Arrange a low-health boss next to the deployed hero; actual attacks must create loot.
  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.enemies=[];const unit=e.state.units.find(u=>u.side==='player');unit.location={zone:'board',col:2,row:7};unit.statuses={};unit.cooldown=0;const m=e.spawnEnemy('husky_wrecker','player');m.progress=5;m.col=2;m.row=6;m.hp=1;m.speed=0;e.tick(.05);e.state.sides.ai.loot=['m02_slipper'];});
  s=await state();assert.ok(s.sides.player.loot.length>=1);const pooled=s.sides.player.loot.length+1;
  await click('orange-plus');
  await page.screenshot({path:path.join(root,'verification','desktop-battle.png'),fullPage:true});
  for(let i=0;i<10;i++)await click('skip');
  await page.locator('#game-dialog [data-action="menu"]').waitFor();s=await state();assert.equal(s.result.winner,'player');assert.equal(s.result.loot.length,pooled);
  const profile=await page.evaluate(()=>structuredClone(window.__CAPY_DEBUG__.profile));assert.equal(profile.wins,1);assert.equal(Object.values(profile.weaponFragments).reduce((sum,count)=>sum+count,0),pooled);assert.equal(profile.freeLotteryTickets,1);mark('Boss death drops loot; skip reaches result; winner receives both pools');
  await page.screenshot({path:path.join(root,'verification','result-dialog.png'),fullPage:true});await click('menu');await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.wins),1);mark('Returning to menu and reloading preserves rewards exactly once');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  assert.equal(await page.locator('#dev-tools').evaluate(e=>e.open),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(root,'verification','mobile-menu.png'),fullPage:true});mark('Narrow layout collapses sandbox and has no horizontal overflow');
  await page.locator('#dev-tools summary').click();await click('reset');assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.matches),0);mark('Reset clears this game profile');
  await page.locator('#dev-tools summary').click();await click('start');
  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.options.ai=false;});
  await click('summon');await page.locator('#battle-canvas').scrollIntoViewIfNeeded();await drag(114,1162,212,780);
  assert.ok((await state()).units.some(u=>u.side==='player'&&u.location.zone==='board'));
  await page.screenshot({path:path.join(root,'verification','mobile-battle.png'),fullPage:true});mark('Narrow canvas pointer deployment uses correct scaled coordinates');
  await page.setViewportSize({width:320,height:844});await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.state.sides.player.food=9;});await page.waitForTimeout(150);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const button=await page.locator('#summon-button').boundingBox(),shortage=await page.locator('#summon-shortage').boundingBox();
  assert.ok(shortage.y+shortage.height<=button.y+button.height+1);
  await page.screenshot({path:path.join(root,'verification','mobile-redraw.png'),fullPage:true});mark('320px redraw and shortage labels remain inside the button');
  await page.setViewportSize({width:1536,height:1200});
  for(const kind of ['kungfu_po','bamboo_mafia','zen_master','puss_in_hat','meowfia','purrcerer','samurai_doge','doge_wick','ronin_goose','ballin_rooster','rocket_coon','pepe_king']){
    await page.evaluate(kind=>{const e=window.__CAPY_DEBUG__.engine;e.state.units=[];e.state.enemies=[];e.state.events=[];const id=e.grant(kind).unitId,u=e.state.units.find(u=>u.id===id);u.location={zone:'board',col:2,row:7};u.energy=50;const m=e.spawnEnemy('rat','player');Object.assign(m,{progress:5,col:2,row:6,hp:100000,maxHp:100000,speed:0});e.tick(.05);},kind);
    await page.waitForTimeout(45);
  }
  mark('All 12 procedural hero and ultimate rendering branches run without exceptions');
  await page.evaluate(()=>{
    const e=window.__CAPY_DEBUG__.engine;e.state.units=[];e.state.enemies=[];e.state.events=[];e.state.sides.player.fog=0;e.state.sides.ai.fog=0;
    const kinds=['kungfu_po','bamboo_mafia','zen_master','puss_in_hat','meowfia','purrcerer','samurai_doge','doge_wick','ronin_goose','ballin_rooster','rocket_coon','pepe_king'];
    for(const side of ['player','ai'])for(let i=0;i<12;i++){
      let col=1+i%6,row=7+Math.floor(i/6);if(side==='ai'){col=7-col;row=9-row;}if(e.state.grid[row][col]==='G'){e.state.sides[side].shovels++;e.dig(col,row,side);}
      const id=e.grant(kinds[i],side).unitId;e.move(id,{zone:'board',col,row});const u=e.state.units.find(u=>u.id===id);u.level=1+i%3;
    }
    for(const side of ['player','ai'])for(let i=0;i<8;i++){const m=e.spawnEnemy(i%3===0?'crab':i%3===1?'rat':'roach',side);m.progress=i*1.8;m.hp=m.maxHp=2000;}
  });
  await page.waitForTimeout(200);await page.screenshot({path:path.join(root,'verification','hero-gallery.png'),fullPage:true});
  assert.deepEqual(errors,[]);mark('No browser console errors or runtime exceptions');
  fs.writeFileSync(path.join(root,'verification','browser-qa.json'),JSON.stringify({passed:true,checks,errors},null,2));
}catch(error){
  await page.screenshot({path:path.join(root,'verification','qa-failure.png'),fullPage:true}).catch(()=>{});
  const diagnostics=await page.evaluate(()=>({state:window.__CAPY_DEBUG__?.engine?.state,pointers:window.__qaPointers})).catch(()=>null);
  fs.writeFileSync(path.join(root,'verification','browser-qa.json'),JSON.stringify({passed:false,checks,errors,failure:String(error),diagnostics},null,2));
  throw error;
}finally{await browser.close();}
