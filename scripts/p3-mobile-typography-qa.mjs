import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter']});
const checks=[],errors=[],measurements=[];let failure=null;
const overlap=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
const inside=(a,b)=>a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;
const mark=text=>{checks.push(text);console.log('PASS '+text);};
const box=(page,selector)=>page.locator(selector).boundingBox().then(b=>({left:b.x,top:b.y,right:b.x+b.width,bottom:b.y+b.height}));
async function fonts(page,selectors,min=12){
  const values=await page.evaluate(selectors=>selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).map(el=>({selector,size:parseFloat(getComputedStyle(el).fontSize),text:el.textContent?.trim().slice(0,55)}))),selectors);
  assert.ok(values.length>0,'Typography selectors resolve visible content');
  for(const value of values)assert.ok(value.size>=min-.01,JSON.stringify(value));
  return values;
}
async function tutorial(page,label,step,portrait){
  const sizes=await fonts(page,['.tutorial-bubble strong','.tutorial-bubble p','.tutorial-bubble button']);
  const bubble=await box(page,'.tutorial-bubble'),stage=await box(page,'#stage'),dock=await box(page,'#summon-button');
  const viewport=page.viewportSize();
  assert.ok(inside(bubble,{left:0,top:0,right:viewport.width,bottom:viewport.height}),JSON.stringify({bubble,viewport}));
  if(!portrait){assert.ok(inside(bubble,stage));assert.ok(bubble.bottom<=dock.top+1,JSON.stringify({step,bubble,dock}));}
  else assert.ok(bubble.bottom<=stage.top+1||bubble.top>=stage.bottom-1||bubble.bottom<=dock.top+1,JSON.stringify({step,bubble,stage}));
  measurements.push({label,screen:`tutorial${step}`,sizes,bubble,stage});
  await page.screenshot({path:path.join(output,`p3-${label}-tutorial${step}.png`)});
}
try{
  for(const viewport of [{width:844,height:390},{width:390,height:844}])for(const language of ['zh-CN','en']){
    const portrait=viewport.height>viewport.width,label=`${portrait?'portrait':'phone-landscape'}-${language}`;
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
    const tap=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().tap();
    try{
      await page.addInitScript(language=>localStorage.setItem('capybara_defense_v1:language',language),language);
      await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
      assert.equal(await page.evaluate(()=>typeof window.__CAPY_DEBUG__),'object','Use Vite for deterministic tutorial setup');
      const sizes=await fonts(page,['.profile-pill b','.profile-pill strong','.menu-system .language-switch button','.map-chips button','.hub-dock b','.hub-dock small']);
      // P4 replaces text boxes with aspect-preserving art; its full composition
      // and pointer geometry are covered by p4-browser-qa.mjs.
      const suffix=language==='zh-CN'?'zh':'en';
      await page.locator(`img[data-art-sticker="ui_btn_start_${suffix}"]`).waitFor();
      const stage=await box(page,'#stage'),profile=await box(page,'.profile-pill'),system=await box(page,'.menu-system');
      assert.ok(!overlap(profile,system),JSON.stringify({label,profile,system}));
      const title=await box(page,'.art-title'),start=await box(page,'#menu-screen .start-button');
      assert.ok(inside(title,stage)&&inside(start,stage)&&!overlap(title,start));
      const buttons=await page.locator('#menu-screen button').evaluateAll(els=>els.map(el=>({rect:el.getBoundingClientRect().toJSON(),scroll:el.scrollWidth,width:el.clientWidth})));
      for(const b of buttons)assert.ok(inside(b.rect,{left:0,top:0,right:viewport.width,bottom:viewport.height}),JSON.stringify({label,b,viewport}));
      measurements.push({label,screen:'menu',sizes});
      await page.screenshot({path:path.join(output,`p3-${label}-menu.png`)});
      await tap('select-map:sunny_backyard');await tap('start');
      await page.evaluate(()=>{window.__CAPY_DEBUG__.engine.options.autoWaves=false;});
      await tutorial(page,label,1,portrait);
      await tap('summon');
      // A deployable pet plus a separate recipe pair exercises the next bubble moving
      // above the finger on pointerup; the resulting click must not dismiss the guide.
      await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.units=[];for(const kind of ['hamster','panda','hat_bamboo','bee','shovel'])e.grant(kind);});
      await page.waitForTimeout(100);await tutorial(page,label,2,portrait);
      const deployment=await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine,unit=e.state.units.find(u=>u.kind!=='shovel'&&u.location.zone==='bench');let tile;for(let row=0;row<5;row++)for(let col=0;col<9;col++)if(!tile&&e.state.grid[row][col]==='O')tile={row,col};return{slot:unit.location.slot,...tile};});
      const canvas=await page.locator('#battle-canvas').boundingBox();
      const touch=(x,y)=>page.touchscreen.tap(canvas.x+x*canvas.width/1280,canvas.y+y*canvas.height/720);
      await touch(252+deployment.slot*104+46,656);await touch(172+(deployment.col+.5)*104,72+(deployment.row+.5)*104);
      await page.locator('[data-action="tutorial-ack"]').waitFor();
      assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.tutorialCompleted),false,'Deploying must not click through to the newly positioned acknowledgement');
      await tutorial(page,label,3,portrait);await tap('tutorial-ack');
      await page.locator('.tutorial-bubble').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.tutorialRewardClaimed),true);
      mark(`${label}: readable contained menu and three tutorial steps with real touch summon/deploy/acknowledge`);
      await page.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.loadout.equippedActiveProps=['milk_bottle'];e.state.units.find(u=>u.location.zone==='board').statuses.SEALED=5;e.spawnEnemy('husky_wrecker','player');e.tick(.12);e.tick=()=>{};});await page.waitForTimeout(200);
      const bossSizes=await fonts(page,['.boss-heading strong','.boss-numbers','.boss-skill span']);
      const boss=await box(page,'#boss-banner'),control=await box(page,'.control-dock'),resource=await box(page,'.resource-dock');
      assert.ok(!overlap(boss,control)&&!overlap(boss,resource),JSON.stringify({label,boss,control,resource}));
      if(!portrait)assert.ok(inside(boss,stage));
      await tap('prop:milk_bottle');
      const hintSizes=await fonts(page,['.prop-target-hint','.sealed-hint','.refresh-badge','#hud-wave','.wave-progress>span','#battle-props button>b']);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1));
      measurements.push({label,screen:'boss',sizes:bossSizes,hintSizes,boss,control,resource});
      await page.locator('#toast').waitFor({state:'hidden'});
      await page.screenshot({path:path.join(output,`p3-${label}-boss.png`)});
      mark(`${label}: readable Boss status with non-overlapping resource and control docks`);
    }catch(error){
      const diagnostic=await page.evaluate(()=>({phase:window.__CAPY_DEBUG__?.engine?.state.phase,wave:window.__CAPY_DEBUG__?.engine?.state.wave,profile:window.__CAPY_DEBUG__?.profile,overlayHidden:document.querySelector('#tutorial-overlay')?.hidden,overlay:document.querySelector('#tutorial-overlay')?.innerHTML,dialog:document.querySelector('#game-dialog')?.open}));
      measurements.push({label,screen:'failure',diagnostic});
      await page.screenshot({path:path.join(output,`p3-${label}-failure.png`)});
      throw error;
    }finally{await context.close();}
  }
  assert.deepEqual(errors,[]);mark('Mobile typography console/pageerror:0');
}catch(error){failure=String(error.stack??error);throw error;}
finally{fs.writeFileSync(path.join(output,'p3-mobile-typography-report.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,measurements,failure},null,2));await browser.close();}
