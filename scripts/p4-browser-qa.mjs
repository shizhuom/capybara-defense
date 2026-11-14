import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',
 env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const errors=[],checks=[],screenshots=[],measurements=[];let failure;
const mark=text=>{checks.push(text);console.log('PASS '+text);};
const overlap=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
const inside=(a,b)=>a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;
async function checkMenu(page,label){
 const data=await page.evaluate(()=>{
  const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
  const title=document.querySelector('.art-title'),start=document.querySelector('#menu-screen .start-button');
  const controls=[...document.querySelectorAll('#menu-screen button')];
  const body=document.documentElement;
  return{stage:rect('#stage'),title:rect('.art-title'),start:rect('#menu-screen .start-button'),map:rect('.map-chips'),
   profile:rect('.profile-pill'),system:rect('.menu-system'),left:rect('.hub-dock-left'),right:rect('.hub-dock-right'),
   hint:document.querySelector('#rotate-hint').getClientRects().length?rect('#rotate-hint'):null,
   size:{width:innerWidth,height:innerHeight},scroll:[body.scrollWidth,body.scrollHeight],
   css:[title,start].map(el=>{const s=getComputedStyle(el);return{background:s.backgroundColor,border:s.borderTopWidth,shadow:s.boxShadow};}),
   medallions:[...document.querySelectorAll('.medallion')].map(el=>({rect:el.getBoundingClientRect().toJSON(),radius:getComputedStyle(el).borderRadius})),
   badges:[...document.querySelectorAll('.hub-dock small')].map(el=>el.getBoundingClientRect().toJSON()),
   controls:controls.map(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {action:el.dataset.action,rect:r.toJSON(),clickable:!el.disabled,hit:hit?.closest('button')===el};}),
   raw:document.querySelector('#menu-screen').textContent,
  };
 });
 const viewport={left:0,top:0,right:data.size.width,bottom:data.size.height},portrait=data.size.height>data.size.width&&data.size.width<=760;
 assert.ok(Math.abs(data.stage.width/data.stage.height-16/9)<.001);
 assert.ok(data.scroll[0]<=data.size.width+1&&data.scroll[1]<=data.size.height+1,'No page scroll');
 for(const r of [data.stage,data.title,data.start,data.map,data.profile,data.system,data.left,data.right])assert.ok(inside(r,viewport),JSON.stringify({label,r,viewport}));
 assert.ok(inside(data.title,data.stage)&&inside(data.start,data.stage));
 assert.ok(!overlap(data.profile,data.system)&&!overlap(data.profile,data.title)&&!overlap(data.system,data.title),'Corner profile and title remain separate');
 const regions=[data.title,data.start,data.map,data.left,data.right];
 for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++)assert.ok(!overlap(regions[i],regions[j]),JSON.stringify({label,a:regions[i],b:regions[j]}));
 const panorama={left:data.stage.left,right:data.stage.right,top:data.stage.top+data.stage.height*.28,bottom:data.stage.top+data.stage.height*.668};
 // Transparent title margins may extend beyond 28%; controls must never cover the animals.
 for(const r of [data.profile,data.system,data.map,data.left,data.right])assert.ok(!overlap(r,panorama),JSON.stringify({label,r,panorama}));
 // Foreground pets extend below the central panorama. These hand-checked art
 // bounds catch oversized phone medallions hiding the hedgehog or frog.
 const foregroundPets=[{name:'hedgehog',x:146,y:505,w:133,h:90},{name:'frog',x:916,y:488,w:110,h:113},{name:'raccoon',x:1084,y:476,w:123,h:115}];
 for(const pet of foregroundPets){
  const rect={left:data.stage.left+pet.x/1280*data.stage.width,top:data.stage.top+pet.y/720*data.stage.height,
   right:data.stage.left+(pet.x+pet.w)/1280*data.stage.width,bottom:data.stage.top+(pet.y+pet.h)/720*data.stage.height};
  for(const dock of [data.left,data.right,...data.badges])assert.ok(!overlap(dock,rect),JSON.stringify({label,pet:pet.name,dock,rect}));
 }
 if(portrait&&data.hint)assert.ok(!overlap(data.map,data.hint),'Map strip and rotation hint do not collide');
 for(const css of data.css){assert.equal(css.background,'rgba(0, 0, 0, 0)');assert.equal(css.border,'0px');assert.equal(css.shadow,'none');}
 for(const m of data.medallions){assert.equal(m.radius,'50%');assert.ok(Math.abs(m.rect.width-m.rect.height)<1);assert.ok(m.rect.width>=43);}
 for(const button of data.controls){assert.ok(inside(button.rect,viewport),JSON.stringify({label,button}));if(button.clickable)assert.ok(button.hit,`Unobstructed hit target ${label} ${button.action}`);}
 assert.doesNotMatch(data.raw,/\b(?:hint|p1|p3|m2|m3|menu|app)\.[a-zA-Z][\w.]*/);
 measurements.push({label,...data});
}
async function readyArt(page,language){
 const suffix=language==='zh-CN'?'zh':'en';
 for(const id of [`title_logo_${suffix}`,`ui_btn_start_${suffix}`]){
  await page.locator(`img[data-art-sticker="${id}"]`).waitFor();
  assert.equal(await page.locator(`[data-art-sticker="${id}"]`).evaluate(el=>el.complete&&el.naturalWidth>0),true);
 }
}
async function exercise(page,tap){
 const cases=[['profile','close-profile'],['settings','close-profile'],['recipes','close-recipes'],['armory','close-meta'],['market','close-meta'],['leaderboard','close-profile']];
 for(const [open,close] of cases){await tap(open);await page.locator('#game-dialog[open]').waitFor();await tap(close);assert.equal(await page.locator('#game-dialog').evaluate(el=>el.open),false);}
 await tap('select-map:sunny_backyard');
 assert.equal(await page.locator('[data-action="select-map:sunny_backyard"]').getAttribute('aria-pressed'),'true');
 await tap('select-map:auto');
 assert.equal(await page.locator('[data-action="select-map:auto"]').getAttribute('aria-pressed'),'true');
}
try{
 for(const [label,viewport,mobile,file] of [
  ['desktop',{width:1440,height:900},false,'p4-start-screen-zh.png'],
  ['mobile-landscape',{width:844,height:390},true,'p4-start-mobile-landscape.png'],
  ['mobile-portrait',{width:390,height:844},true,'p4-start-mobile-portrait.png'],
 ]){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1}),page=await context.newPage();
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  const tap=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first()[mobile?'tap':'click']();
  try{
   await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await readyArt(page,'zh-CN');
   await checkMenu(page,label+' zh');await page.screenshot({path:path.join(output,file)});screenshots.push(file);
   await exercise(page,tap);await tap('en');await readyArt(page,'en');await checkMenu(page,label+' en');
   const enFile=label==='desktop'?'p4-start-screen-en.png':`p4-${label}-en.png`;
   await page.screenshot({path:path.join(output,enFile)});screenshots.push(enFile);
   await exercise(page,tap);await tap('zh-CN');await readyArt(page,'zh-CN');
   await tap('start');await page.locator('#battle-hud:not([hidden])').waitFor();await tap('tutorial-skip');
   await tap('summon');assert.equal(await page.locator('#summon-cost').innerText(),'12');
   await tap('pause');await tap('surrender');await tap('menu');await readyArt(page,'zh-CN');
   assert.equal(await page.locator('#menu-screen').isVisible(),true);
   mark(`${label}: zh/en art, clear composition, seven hub routes, map selection and battle round trip`);
  }finally{await context.close();}
 }
 // Delay the optional asset manifest: the real UI must work with SVG and then upgrade itself.
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 let release;const delay=new Promise(resolve=>{release=resolve;});
 await page.route('**/sprites/manifest.json',async route=>{await delay;await route.continue();});
 try{
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'domcontentloaded'});
  await page.locator('svg[data-art-sticker="title_logo_zh"]').waitFor();
  await page.locator('[data-action="en"]').filter({visible:true}).first().click();
  await page.locator('svg[data-art-sticker="title_logo_en"]').waitFor();
  await checkMenu(page,'delayed assets');
  await page.screenshot({path:path.join(output,'p4-fallback.png')});screenshots.push('p4-fallback.png');
  release();await readyArt(page,'en');
  await page.locator('img[data-sticker="ui_trophy_rank"]').waitFor();await page.locator('img[data-sticker="ui_map_sign"]').waitFor();
  mark('Delayed manifest: localized vector fallback becomes decoded PNG without losing language or menu actions');
  // Seed only this temporary browser's public save, then exercise actual menu actions.
  // This runs on both Vite and the built game without exposing a production debug API.
  {
   await page.locator('[data-action="select-map:sunny_backyard"]').click();
   await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('capybara_defense_v1:profile'));p.highestStars=1000;p.stars=1000;p.coins=999999;p.freeLotteryTickets=999;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(p));});
   await page.reload({waitUntil:'networkidle'});await readyArt(page,'en');
   for(const map of ['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze','auto']){
    await page.locator(`[data-action="select-map:${map}"]`).click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')).selectedMap),map);
   }
   for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:390,height:844},{width:320,height:568}]){await page.setViewportSize(viewport);await checkMenu(page,`high-rank ${viewport.width}`);}
   mark('All unlocked map choices persist; long English high-rank profile and badges fit through 320px');
  }
 }finally{release();await context.close();}
 assert.deepEqual(errors,[]);mark('Console and pageerror: 0');
}catch(error){failure=error.stack;console.error(failure);}
finally{await browser.close();fs.writeFileSync(path.join(output,'p4-browser-report.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,failure,screenshots,measurements,passed:!failure&&!errors.length},null,2));}
if(failure||errors.length)process.exitCode=1;
