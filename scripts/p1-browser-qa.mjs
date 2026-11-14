import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'verification'), temp=path.join(root,'.runtime','browser-tmp');
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(temp,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',
  env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[],checks=[],screenshots=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const mark=text=>{checks.push(text);console.log('PASS '+text);};
const click=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().click();
const snap=async name=>{const file=`p1-${name}.png`;if(name.startsWith('map-'))await page.locator('#stage').screenshot({path:path.join(output,file)});else await page.screenshot({path:path.join(output,file),fullPage:name==='desktop-sandbox'});screenshots.push(file);};
const fit=async()=>{
  const geometry=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,stage:document.querySelector('#stage').getBoundingClientRect().toJSON()}));
  assert.ok(geometry.sw<=geometry.w+1,JSON.stringify(geometry));assert.ok(geometry.sh<=geometry.h+1,JSON.stringify(geometry));
  assert.ok(geometry.stage.bottom<=geometry.h,JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.stage.width/geometry.stage.height-640/1386)<.001);
};
async function point(x,y){const r=await page.locator('canvas').boundingBox();return{x:r.x+x*r.width/640,y:r.y+y*r.height/1386};}
async function tap(x,y){const p=await point(x,y);await page.mouse.click(p.x,p.y);}
async function drag(x,y,tx,ty){const a=await point(x,y),b=await point(tx,ty);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();}
const quiet=()=>page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.options.ai=false;e.state.enemies=[];});
try{
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  await fit();assert.equal(await page.locator('.sandbox-column').isVisible(),false);await snap('mobile-menu');
  mark('390×844 clean menu fits one screen; sandbox hidden');
  await click('start');await quiet();await fit();await snap('mobile-tutorial');
  assert.match(await page.locator('.tutorial-bubble').innerText(),/01/);
  await click('summon');assert.match(await page.locator('.tutorial-bubble').innerText(),/02/);
  const target=await page.evaluate(()=>{const s=window.__CAPY_DEBUG__.engine.state;for(let row=5;row<10;row++)for(let col=0;col<8;col++)if(s.grid[row][col]==='O'&&!s.units.some(u=>u.side==='player'&&u.location.zone==='board'&&u.location.col===col&&u.location.row===row))return{col,row};});
  assert.ok(target);await drag(114,1162,32+(target.col+.5)*72,240+(target.row+.5)*72);
  assert.match(await page.locator('.tutorial-bubble').innerText(),/03/);await click('tutorial-ack');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),20);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')).tutorialCompleted),true);
  await click('settings');await click('tutorial-replay');await click('tutorial-skip');
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),20);
  mark('Real summon and drag advance tutorial; +20 persists once; replay/skip cannot duplicate it');
  await click('settings');await page.locator('[data-setting="developerMode"]').check();await click('close-profile');
  assert.equal(await page.locator('.sandbox-column').isVisible(),true);
  await click('settings');await page.locator('[data-setting="developerMode"]').uncheck();await click('close-profile');await fit();
  mark('Developer setting toggles immediately, persists, and keeps current battle');
  await page.evaluate(()=>{
    const e=window.__CAPY_DEBUG__.engine;e.state.units=[];e.state.events=[];e.state.grid[6][3]='O';e.state.grid[8][3]='O';
    const first=e.grant('panda').unitId,second=e.grant('hat_bamboo').unitId;e.move(second,{zone:'board',col:3,row:6});e.grant('hat_shades');
    const hero=e.grant('ronin_goose').unitId;e.move(hero,{zone:'board',col:3,row:8});
    e.state.units.find(u=>u.id===hero).energy=7.8;e.state.sides.player.food=500;
    window.__p1Source=first;
  });
  await page.keyboard.press('Escape');await tap(114,1162);await page.waitForTimeout(180);
  assert.match(await page.locator('#inspector').innerText(),/熊猫|Panda/);
  await snap('mobile-gold-matches');await fit();
  const dragFrom=await point(114,1162),dragTo=await point(260,890);
  await page.mouse.move(dragFrom.x,dragFrom.y);await page.mouse.down();await page.mouse.move(dragTo.x,dragTo.y,{steps:8});
  await snap('mobile-drag-gold-matches');await page.mouse.move(dragFrom.x,dragFrom.y,{steps:4});await page.mouse.up();
  await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;const b=e.spawnEnemy('box_kraken','player');b.progress=5;b.abilityCooldown=1.5;b.hp=b.maxHp*.63;e.state.phase='paused';});
  await page.waitForTimeout(180);assert.equal(await page.locator('#boss-banner').isVisible(),true);await snap('mobile-boss');
  mark('Gold board + nest matches, hero base, box seal and live Boss health/cooldown visible');
  await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.state.phase='playing';});
  await click('recipes');
  for(const [tab,count]of Object.entries({heroes:12,bosses:12,weapons:36,props:20})){
    await click(`book:${tab}`);assert.equal(await page.locator('#book-content [data-entry]').count(),count);await snap(`mobile-book-${tab}`);
    await page.locator('#game-dialog [data-action="en"]').click();
    const text=await page.locator('#book-content').innerText();assert.doesNotMatch(text,/[\u3400-\u9fff]/);assert.doesNotMatch(text,/p1\.[\w.]+/);
    await page.locator('#game-dialog [data-action="zh-CN"]').click();
  }
  await click('close-recipes');mark('All 80 compendium entries render with resolved Chinese/English descriptions');
  await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(150);await fit();await snap('desktop-clean-boss');
  await click('settings');await page.locator('[data-setting="developerMode"]').check();await click('close-profile');
  await snap('desktop-sandbox');await click('pause');await click('surrender');await click('menu');
  await click('test-enable');
  await click('armory');assert.equal(await page.locator('.weapon-card').count(),36);await snap('desktop-armory');await click('close-meta');
  await click('market');await snap('desktop-market');await click('meta-tab:lottery');await click('meta-spin');await page.waitForTimeout(3000);await snap('desktop-lottery');await click('close-meta');
  for(const map of ['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze']){
    await page.locator('#dev-map').selectOption(map);await click('start');await quiet();await snap(`map-${map}`);
    await click('pause');await click('surrender');await click('menu');
  }
  mark('Desktop sandbox, 36-weapon armory, shop/lottery and all four textured maps work');
  await click('test-restore');
  await page.goto('http://127.0.0.1:4175/?dev=1',{waitUntil:'networkidle'});assert.equal(await page.locator('.sandbox-column').isVisible(),true);
  await click('settings');await page.locator('[data-setting="developerMode"]').uncheck();await click('close-profile');
  assert.equal(new URL(page.url()).searchParams.has('dev'),false);assert.equal(await page.locator('.sandbox-column').isVisible(),false);
  await snap('desktop-clean-menu');mark('Query dev=1 enables sandbox; settings can turn it off and remove the override');
  assert.deepEqual(errors,[]);mark('Console and pageerror: 0');
}finally{
  fs.writeFileSync(path.join(output,'p1-browser-report.json'),JSON.stringify({checks,errors,screenshots},null,2));
  await browser.close();
}
