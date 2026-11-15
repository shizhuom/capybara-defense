import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification');
process.env.TEMP=process.env.TMP=path.join(root,'.runtime/browser-tmp');
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const checks=[],errors=[];let failure;
const act=async(p,a)=>{await p.locator(`[data-action="${a}"]`).filter({visible:true}).first().click();await p.waitForTimeout(80);};
try{
 const c=await browser.newContext({viewport:{width:844,height:390}}),p=await c.newPage();
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
 await p.evaluate(()=>{const a=window.__CAPY_DEBUG__,profile=structuredClone(a.profile);Object.assign(profile,{stars:20,highestStars:20,coins:9999,tutorialCompleted:true,selectedMap:'sunny_backyard',unlockedWeapons:['m10_bamboo_staff'],weaponFragments:{m10_bamboo_staff:20},equippedWeapons:{kungfu_po:'m10_bamboo_staff'}});localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));});await p.reload({waitUntil:'networkidle'});
 await act(p,'armory');await p.locator('.p9-loadout-overview summary').click();await act(p,'meta-unequip:kungfu_po');
 assert.ok(await p.locator('.p9-loadout-overview').evaluate(e=>e.open),'Unequip preserves the overview drawer');
 assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-loadout-hero')),'kungfu_po','Unequip focuses the updated hero stand');
 await p.locator('.recycle-panel summary').click();await p.locator('[data-rarity="0"]').focus();await p.keyboard.press('Space');
 assert.ok(await p.locator('.recycle-panel').evaluate(e=>e.open));assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-rarity')),'0');await act(p,'close-meta');checks.push('Armory drawers and keyboard focus survive updates');
 await act(p,'market');
 const visibleShelf=await p.evaluate(()=>{const body=document.querySelector('.ledger-body').getBoundingClientRect(),card=document.querySelector('.p9-daily-shelf .shop-card').getBoundingClientRect();return Math.min(body.bottom,card.bottom)-Math.max(body.top,card.top);});
 assert.ok(visibleShelf>=40,`First market goods must be visible without discovering a scroll (${visibleShelf}px)`);
 await p.locator('.p9-market-racks').evaluate(el=>{el.style.scrollBehavior='auto';el.scrollTop=el.querySelector('.p9-prop-packets').offsetTop-el.offsetTop;});
 await p.screenshot({path:path.join(out,'p9-mobile-market-packet-rack.png')});
 await act(p,'close-meta');await act(p,'en');await p.setViewportSize({width:390,height:844});await act(p,'leaderboard');
 assert.ok(await p.locator('.profile-navigation').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'All portrait navigation bookmarks fit');
 await act(p,'close-profile');checks.push('Phone first shelf visible and English portrait bookmarks contained');
 await p.setViewportSize({width:844,height:390});await act(p,'zh-CN');
 for(const screen of ['settings','armory']){
  await act(p,'start');await p.locator(`[data-action="${screen}"]`).first().evaluate(e=>e.click());
  await p.locator('#battle-transition').waitFor({state:'hidden'});await p.waitForTimeout(350);
  assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.phase),'paused');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.waveTime),0);
  assert.ok(await p.evaluate(()=>document.querySelector('#game-dialog').contains(document.activeElement)),'Transition completion preserves dialog focus');
  await act(p,screen==='settings'?'close-profile':'close-meta');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.phase),'playing');
  await act(p,'pause');await act(p,'surrender');await act(p,'menu');
 }
 checks.push('Settings and armory during curtain freeze battle, keep focus, resume only after closing');
 await act(p,'start');await p.locator('#battle-transition').waitFor({state:'hidden'});
 for(const col of [2,6]){
  if(await p.locator('#live-unit-card').count())await act(p,'clear');
  const xy=await p.evaluate(col=>{const e=window.__CAPY_DEBUG__.engine;e.setTutorialHold(true);e.state.units=[];const id=e.grant('hamster').unitId;e.state.grid[1][col]='O';e.move(id,{zone:'board',col,row:1});e.spawnBoss('hornet_queen');return{x:172+(col+.5)*104,y:72+1.5*104};},col);
  await p.waitForTimeout(180);
  const canvas=await p.locator('#battle-canvas').boundingBox();await p.mouse.click(canvas.x+xy.x*canvas.width/1280,canvas.y+xy.y*canvas.height/720);
  await p.locator('#live-unit-card').waitFor({state:'visible'});await p.waitForTimeout(100);
  assert.ok(await p.evaluate(()=>{const a=document.querySelector('#enemy-alert-banner').getBoundingClientRect(),b=document.querySelector('#live-unit-card').getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;}),'Entry alert avoids selected card on either margin');
 }
 await p.screenshot({path:path.join(out,'p9-mobile-entry-with-live-card.png')});checks.push('Live unit cards on both margins remain clear of the enemy alert');
 await p.evaluate(()=>{const profile=structuredClone(window.__CAPY_DEBUG__.profile);Object.assign(profile,{stars:0,highestStars:0,mergedHeroes:[],tutorialCompleted:true});localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));});
 await p.setViewportSize({width:1366,height:768});await p.reload({waitUntil:'networkidle'});await act(p,'start');await p.locator('#battle-transition').waitFor({state:'hidden'});
 await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.oranges=100;while(e.state.phase!=='finished')e.skipWave();});
 await p.locator('.roster-unlock-celebration').waitFor();await p.locator('.roster-unlock-celebration').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'p9-victory-roster-unlock-celebration.png')});
 checks.push('First normal victory visibly celebrates the one-star roster tier');
 assert.deepEqual(errors,[]);await c.close();
}catch(error){failure=error.stack;throw error;}finally{
 await browser.close();fs.writeFileSync(path.join(out,'p9-interaction-report.json'),JSON.stringify({passed:!failure,checks,errors,failure},null,2));
}
