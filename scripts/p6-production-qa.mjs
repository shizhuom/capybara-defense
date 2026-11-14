import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});
process.env.TEMP=temp;process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],requests=[];
const mark=text=>{checks.push(text);console.log('PASS '+text);};
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.on('request',r=>requests.push(new URL(r.url()).pathname));
  const click=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().click();
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>typeof window.__CAPY_DEBUG__),'undefined');
  assert.equal(await page.locator('.sandbox-column').isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1));
  await click('start');await click('summon');
  const badge=await page.locator('.redraw-hero-badge').boundingBox();assert.ok(badge&&badge.height<=26&&badge.width>=80,'Portrait hero reminder must stay a compact horizontal badge: '+JSON.stringify(badge));
  await click('tutorial-skip');
  assert.match(await page.locator('#summon-button').innerText(),/12/);await click('summon');
  assert.equal(await page.locator('#food-value').innerText(),'0');
  await page.screenshot({path:path.join(root,'verification/p6-production-mobile.png')});
  await click('recipes');await click('book:props');assert.equal(await page.locator('[data-entry]').count(),20);
  await click('close-recipes');await click('pause');await click('surrender');await click('menu');
  const stored=await page.evaluate(()=>localStorage.getItem('capybara_defense_v1:profile'));
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>localStorage.getItem('capybara_defense_v1:profile')),stored);
  mark('Built production has no debug API; clean390×844 mode, redraw, compendium, settlement and reload work');
  await context.close();

  // A static mount served from the actual dist bytes: relative requests must stay under the mount.
  const nested=await browser.newContext({viewport:{width:390,height:844}}),nestedPage=await nested.newPage(),prefix='/p6-check/game/';
  nestedPage.on('pageerror',e=>errors.push(e.message));nestedPage.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  const nestedRequests=[];nestedPage.on('request',r=>nestedRequests.push(new URL(r.url()).pathname));
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
  await nestedPage.route(`**${prefix}**`,async route=>{
    const pathname=new URL(route.request().url()).pathname,relative=decodeURIComponent(pathname.slice(prefix.length))||'index.html',file=path.resolve(dist,relative);
    assert.ok(file.startsWith(dist+path.sep),'Static fixture path remains inside dist');
    if(!fs.existsSync(file)){await route.fulfill({status:404,body:'Not found'});return;}
    await route.fulfill({status:200,contentType:mime[path.extname(file)]??'application/octet-stream',body:fs.readFileSync(file)});
  });
  await nestedPage.goto(`http://127.0.0.1:4175${prefix}`,{waitUntil:'networkidle'});
  await nestedPage.locator('[data-action="start"]').click();await nestedPage.locator('[data-action="tutorial-skip"]').click();
  await nestedPage.waitForTimeout(200);
  assert.ok(nestedRequests.some(url=>url===`${prefix}assets/sprites/manifest.json`));
  assert.ok(nestedRequests.some(url=>url===`${prefix}audio/manifest.json`));
  assert.ok(nestedRequests.filter(url=>url.endsWith('.png')).length>=193);
  assert.ok(nestedRequests.every(url=>url.startsWith(prefix)));
  await nestedPage.screenshot({path:path.join(root,'verification/p6-subdirectory-mobile.png')});await nested.close();
  mark('Built bundle mounted at /p6-check/game/ resolves JS/CSS, all193 PNGs and audio manifest beneath that directory');
  assert.deepEqual(errors,[]);mark('Production + subdirectory console/pageerror:0');
}finally{fs.writeFileSync(path.join(root,'verification/p6-production-report.json'),JSON.stringify({checks,errors,requests},null,2));await browser.close();}
