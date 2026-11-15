import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {auditDialogText} from './browser-style-audit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const reports=[],errors=[],screenshots=[],checks=[];let failure;
const url=process.env.CAPY_TEST_URL??'http://127.0.0.1:4175/';
async function action(p,name){await p.locator(`[data-action="${name}"]`).filter({visible:true}).first().click();await p.waitForTimeout(90);}
async function shot(p,name){await p.screenshot({path:path.join(out,`${name}.png`)});screenshots.push(`${name}.png`);}
async function seed(p,stars=0){await p.evaluate(async stars=>{
 const {createProfile}=await import('/src/core/MetaProgression.ts'),{WEAPONS}=await import('/src/config/weapons.ts'),{PROPS}=await import('/src/config/props.ts');
 const profile=createProfile();Object.assign(profile,{stars,highestStars:stars,coins:9999,selectedMap:'auto',tutorialCompleted:true,tutorialRewardClaimed:true,freeLotteryTickets:2,unlockedWeapons:Object.keys(WEAPONS),weaponFragments:Object.fromEntries(Object.keys(WEAPONS).map(id=>[id,20])),ownedProps:Object.fromEntries(['washer','clay','gold_doge','auto_shovel','milk_bottle','extra_oranges'].filter(id=>PROPS[id]).map(id=>[id,1])),equippedActiveProps:['washer','clay'],equippedPassiveProps:['gold_doge','auto_shovel'],equippedWeapons:{kungfu_po:'m10_bamboo_staff'}});
 profile.settings.musicVolume=profile.settings.soundVolume=0;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.removeItem('capybara_defense_v1:normalProfileBackup');
 },stars);await p.reload({waitUntil:'networkidle'});}
async function audit(p,label){
 const report=await auditDialogText(p);reports.push({label,...report});
 const fit=await p.locator('#game-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return{inside:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,overflow:[...d.querySelectorAll('.ledger-body,.p9-weapon-rack,.p9-anvil,.p9-merchant,.p9-market-racks,.ledger-tabs')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({class:e.className,width:e.clientWidth,scroll:e.scrollWidth}))};});
 report.layout=fit;console.log(`${label}: ${report.checked} text runs / ${report.issues.length} style issues / ${fit.overflow.length} overflow`);
 assert.ok(fit.inside,label+' dialog inside viewport');assert.deepEqual(fit.overflow,[],label+' horizontal overflow');
 assert.equal(await p.locator('#game-dialog select,#game-dialog .dialog-language').count(),0,label+' no dropdown/language controls');
 const text=await p.locator('#game-dialog').innerText();assert.doesNotMatch(text,/(?:p[1-9]|m[23]|hero|weapon|prop|unit|fragment)\.[a-z_]+/,label+' translated');
 for(const e of await p.locator('.p9-weapon-rack,.p9-anvil,.p9-speech,.p9-market-racks,.ledger-body').all())if(await e.isVisible()){
  assert.ok(await e.evaluate(el=>{el.style.scrollBehavior='auto';el.scrollTop=el.scrollHeight;const ok=el.scrollHeight-el.clientHeight-el.scrollTop<3;el.scrollTop=0;return ok;}),label+' internal scrolling reaches end');
 }
 const broken=await p.locator('img').evaluateAll(es=>es.filter(e=>e.complete&&!e.naturalWidth).map(e=>e.src));assert.deepEqual(broken,[],label+' images');
}
async function finishBattle(p,won){await p.evaluate(won=>{
 const e=window.__CAPY_DEBUG__.engine;e.setTutorialHold(false);e.state.sides.player.oranges=100;e.state.sides.player.loot=['m05_duster','m10_bamboo_staff'];
 e.state.units=[];const id=e.grant('kungfu_po').unitId;e.state.grid[1][2]='O';e.move(id,{zone:'board',col:2,row:1});e.hurt(e.spawnEnemy('rat','player'),999,e.state.units[0]);
 if(won){while(e.state.phase!=='finished')e.skipWave();}else e.surrender();
 },won);await p.locator(won?'.result-win':'.result-loss').waitFor();}
try{
 for(const [label,viewport] of [['desktop',{width:1366,height:768}],['mobile',{width:844,height:390}],['1080p',{width:1920,height:1080}],['portrait',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,reducedMotion:label==='portrait'?'reduce':'no-preference'}),p=await context.newPage();
  p.on('pageerror',e=>errors.push(label+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(label+': '+m.text());});
  await p.goto(url,{waitUntil:'networkidle'});await seed(p,0);
  await action(p,'zh-CN');assert.match(await p.locator('#menu-screen .map-chips').innerText(),/随机/);await shot(p,`p9-${label}-start-random`);
  for(const lang of ['zh-CN','en']){
   await action(p,lang);await action(p,'recipes');await action(p,'book:matrix');await audit(p,`${label}-${lang}-matrix-locked`);
   await action(p,'book:heroes');assert.equal(await p.locator('.portrait-tile.locked-roster').count(),10);await audit(p,`${label}-${lang}-locked-heroes`);if(lang==='zh-CN')await shot(p,`p9-${label}-compendium-zero-stars`);
   await action(p,'compendium-entry:pepe_king');assert.equal(await p.locator('.book-growth').count(),0);await audit(p,`${label}-${lang}-locked-detail`);await action(p,'close-recipes');
   for(const [name,close]of [['armory','close-meta'],['market','close-meta'],['leaderboard','close-profile'],['profile','close-profile'],['settings','close-profile']]){
    await action(p,name);
    if(name==='armory'){
     await action(p,'meta-weapon:m10_bamboo_staff');await audit(p,`${label}-${lang}-armory`);if(lang==='zh-CN')await shot(p,`p9-${label}-armory-pedestal`);
     await action(p,'meta-equip:m10_bamboo_staff:kungfu_po');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedWeapons.kungfu_po),undefined);
     await action(p,'meta-equip:m10_bamboo_staff:kungfu_po');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedWeapons.kungfu_po),'m10_bamboo_staff');
    }else if(name==='market'){
     await action(p,'meta-tab:shop');await action(p,'meta-packet:washer');await audit(p,`${label}-${lang}-market`);if(lang==='zh-CN')await shot(p,`p9-${label}-market-trunk-packets`);
     const offer=await p.evaluate(async()=>{const a=window.__CAPY_DEBUG__,id=a.profile.shop.offers[0],{PROPS}=await import('/src/config/props.ts');return{id,price:PROPS[id].price,level:a.profile.ownedProps[id]??0,coins:a.profile.coins};});
     await p.locator(`.p9-daily-shelf [data-action="meta-buy:${offer.id}"]`).click();assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),offer.coins-offer.price);assert.equal(await p.evaluate(id=>window.__CAPY_DEBUG__.profile.ownedProps[id],offer.id),offer.level+1);
     const coins=await p.evaluate(()=>window.__CAPY_DEBUG__.profile.coins);await action(p,'meta-refresh');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),coins-20);
     const before=await p.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedActiveProps.includes('washer'));await action(p,'meta-prop:washer');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedActiveProps.includes('washer')),!before);
     await action(p,'meta-tab:lottery');await audit(p,`${label}-${lang}-gacha`);if(lang==='zh-CN')await shot(p,`p9-${label}-gacha-arcade`);
     const ticket=await p.evaluate(()=>window.__CAPY_DEBUG__.profile.freeLotteryTickets);await action(p,lang==='en'?'meta-spin:coins':'meta-spin:ticket');await p.locator('.lottery-result').waitFor();assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.freeLotteryTickets),ticket-(lang==='en'?0:1));await audit(p,`${label}-${lang}-gacha-reveal`);
     await action(p,'meta-tab:shop');
    }else {await audit(p,`${label}-${lang}-${name}`);if(lang==='zh-CN')await shot(p,`p9-${label}-${name}`);}
    await action(p,close);
   }
  }
  await action(p,'zh-CN');await p.locator('#menu-screen [data-action="start"]').click();await p.waitForTimeout(label==='portrait'?30:350);
  assert.ok(await p.locator('#battle-transition').isVisible());assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.spawned),0);assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.nextSpawn),18);
  await shot(p,`p9-${label}-battle-clash-curtain`);await p.locator('#battle-transition').waitFor({state:'hidden'});
  await action(p,'pause');await audit(p,`${label}-pause`);await action(p,'resume');await finishBattle(p,true);await audit(p,`${label}-victory-unlock`);assert.equal(await p.locator('.roster-unlock-celebration').count(),1);await shot(p,`p9-${label}-victory-unlock`);await action(p,'menu');
  await seed(p,20);await action(p,'start');await p.locator('#battle-transition').waitFor({state:'hidden'});
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.setTutorialHold(true);e.spawnEnemy('crab','player');});
  await p.locator('#enemy-alert-banner').waitFor({state:'visible'});await shot(p,`p9-${label}-elite-entry-alert`);
  await p.waitForTimeout(2700);await p.evaluate(()=>window.__CAPY_DEBUG__.engine.spawnBoss('hornet_queen'));await p.locator('#enemy-alert-banner.boss-entry').waitFor();await shot(p,`p9-${label}-boss-entry-alert`);
  const collision=await p.evaluate(()=>{const a=document.querySelector('#enemy-alert-banner').getBoundingClientRect();return['.resource-dock','.control-dock','#boss-banner'].filter(s=>{const b=document.querySelector(s).getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});});assert.deepEqual(collision,[],label+' entry banner clears top HUD');
  await finishBattle(p,false);await audit(p,`${label}-defeat`);await context.close();checks.push(label+' purchase/equip, locked roster, curtain hold, entry alerts and unlock settlement');
 }
 assert.deepEqual(errors,[]);assert.ok(reports.every(r=>!r.issues.length),'Style audit failed: '+JSON.stringify(reports.filter(r=>r.issues.length).map(r=>({label:r.label,issues:r.issues.slice(0,4)}))));
}catch(error){failure=error.stack;throw error;}finally{
 await browser.close();fs.writeFileSync(path.join(out,'p9-browser-report.json'),JSON.stringify({passed:!failure&&!errors.length,reports,errors,checks,screenshots,failure},null,2));
}
