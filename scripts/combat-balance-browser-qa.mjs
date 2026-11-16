import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const root=process.cwd(),temp=path.join(root,'.runtime/combat-balance-browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],screenshots=[];let failure,activePage;
try{
  for(const [label,viewport]of [['desktop',{width:1366,height:768}],['mobile',{width:844,height:390}]]){
    const context=await browser.newContext({viewport}),page=await context.newPage();activePage=page;
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
    await page.evaluate(async()=>{
      const {createProfile}=await import('/src/core/MetaProgression.ts');const profile=createProfile();
      Object.assign(profile,{stars:20,highestStars:20,tutorialCompleted:true,tutorialRewardClaimed:true,selectedMap:'sunny_backyard'});
      profile.settings.musicVolume=profile.settings.soundVolume=0;
      localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.setItem('capybara_defense_v1:language','zh-CN');
    });
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#menu-screen [data-action="start"]').click();await page.waitForTimeout(1400);
    await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.state.units=[];e.state.enemies=[];e.grant('hamster');e.state.units[0].location={zone:'board',col:2,row:1};});
    const canvas=await page.locator('#battle-canvas').boundingBox();
    const select=()=>page.mouse.click(canvas.x+432/1280*canvas.width,canvas.y+228/720*canvas.height);
    await select();await page.waitForTimeout(120);
    assert.match(await page.locator('[data-live-stat="damage"]').textContent(),/16/);
    assert.match(await page.locator('[data-live-stat="range"]').textContent(),/1\.6/);
    await page.locator('#live-unit-card [data-action="inspect-book:hamster"]').click();
    const values=await page.locator('.book-growth tbody tr:first-child td').allTextContents();assert.equal(values[0],'16');
    await page.locator('[data-action="close-recipes"]').click();
    await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.units=[];e.grant('kungfu_po');e.state.units[0].location={zone:'board',col:2,row:1};});
    await page.waitForTimeout(80);await select();await page.waitForTimeout(120);
    assert.match(await page.locator('[data-live-stat="damage"]').textContent(),/50/);
    assert.match(await page.locator('[data-live-stat="range"]').textContent(),/1\.8/);
    const shot=`combat-balance-${label}-live-stats.png`;await page.screenshot({path:path.join(root,'verification',shot)});screenshots.push(shot);
    await page.evaluate(async()=>{
      const e=window.__CAPY_DEBUG__.engine,{GridSystem}=await import('/src/core/GridSystem.ts');e.state.units=[];e.grant('meowfia');
      const unit=e.state.units[0];unit.location={zone:'board',col:2,row:1};unit.energy=11;
      const target=e.spawnEnemy('rat','player');target.progress=2;Object.assign(target,GridSystem.pathPosition('player',2));target.speed=0;target.hp=target.maxHp=1e8;
    });
    await page.waitForTimeout(600);
    const during=await page.evaluate(()=>{const u=window.__CAPY_DEBUG__.engine.state.units[0];return{buff:u.buffTime,energy:u.energy};});
    assert(during.buff>0);assert.equal(during.energy,0);
    await page.waitForTimeout(2300);
    const after=await page.evaluate(()=>{const u=window.__CAPY_DEBUG__.engine.state.units[0];return{buff:u.buffTime,energy:u.energy};});
    assert.equal(after.buff,0);assert(after.energy>0&&after.energy<12);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    checks.push({label,values,liveDamage:50,liveRange:1.8,during,after});await context.close();
  }
  assert.deepEqual(errors,[]);
}catch(error){failure=error;console.error(error.stack??error);if(activePage&&!activePage.isClosed()){
  console.log(await activePage.evaluate(()=>({phase:window.__CAPY_DEBUG__?.engine?.state.phase,units:window.__CAPY_DEBUG__?.engine?.state.units,dialog:document.querySelector('dialog')?.open,card:document.querySelector('#live-unit-card')?.outerHTML})));
  await activePage.screenshot({path:path.join(root,'.runtime/combat-balance-browser-failure.png')});
}}
finally{
  await browser.close();const report={passed:!failure,checks,screenshots,errors,failure:failure?.message};
  fs.writeFileSync(path.join(root,'verification/combat-balance-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(failure)process.exitCode=1;
