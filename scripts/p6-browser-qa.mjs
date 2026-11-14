import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const checks=[],errors=[],screenshots=[],measurements=[];let failure,lastPage;
const mark=s=>{checks.push(s);console.log('PASS '+s);};
const settle=p=>p.waitForTimeout(180);
const overlap=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
async function action(p,name,scope){scope??=await p.locator('#game-dialog').evaluate(e=>e.open)?'#game-dialog':'#menu-screen';await p.locator(`${scope} [data-action="${name}"]`).filter({visible:true}).first().click();await settle(p);}
async function shot(p,name){await p.screenshot({path:path.join(out,name)});screenshots.push(name);}
async function tap(p,x,y){const r=await p.locator('#battle-canvas').boundingBox();await p.mouse.click(r.x+x/1280*r.width,r.y+y/720*r.height);await settle(p);}
async function target(p,part){const r=await p.locator(`[data-tutorial-target="${part}"]`).boundingBox();assert.ok(r);await p.mouse.click(r.x+r.width/2,r.y+r.height/2);await settle(p);}
async function fit(p,label){
 const m=await p.evaluate(()=>{const d=document.querySelector('#game-dialog'),r=e=>e?.getBoundingClientRect().toJSON();return{w:innerWidth,h:innerHeight,dialog:r(d),header:r(d.querySelector('.ledger-header')),tabs:r(d.querySelector('.ledger-tabs')),body:r(d.querySelector('.ledger-body')),footer:r(d.querySelector('.settlement-actions')),text:d.textContent,scroll:[...d.querySelectorAll('.ledger-body,.market-stall,.market-backpack')].map(e=>({name:e.className,w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight}))};});
 assert.ok(m.dialog.left>=0&&m.dialog.right<=m.w+1&&m.dialog.top>=0&&m.dialog.bottom<=m.h+1,label+' viewport');
 assert.ok(m.body.height>70,label+' usable scroll body');assert.ok(m.header.bottom<=m.body.top+1,label+' header separate');
  if(m.footer)assert.ok(m.body.bottom<=m.footer.top+1&&m.footer.bottom<=m.dialog.bottom,label+' fixed footer');
 for(const s of m.scroll)assert.ok(s.sw<=s.w+2,label+' no horizontal overflow '+JSON.stringify(s));
 assert.doesNotMatch(m.text,/(?:p6|p5|p3|m3|m2|hint|hero|weapon|prop)\.[a-z_]+/);
 for(const selector of ['.ledger-body','.market-stall','.market-backpack']){const loc=p.locator(`#game-dialog ${selector}`);if(!await loc.count())continue;const s=await loc.evaluate(e=>{e.style.scrollBehavior='auto';e.scrollTop=e.scrollHeight;const v={n:e.scrollTop,max:e.scrollHeight-e.clientHeight};e.scrollTop=0;return v;});assert.ok(Math.abs(s.n-s.max)<2,label+' reachable bottom '+selector);}
 measurements.push({label,...m});return m;
}
async function guideFit(p,label){
 const m=await p.evaluate(()=>{const r=e=>e?.getBoundingClientRect().toJSON();return{w:innerWidth,h:innerHeight,bubble:r(document.querySelector('.tutorial-bubble')),targets:[...document.querySelectorAll('[data-tutorial-target]')].map(r),card:r(document.querySelector('#live-unit-card')),boss:document.querySelector('#boss-banner').hidden?null:r(document.querySelector('#boss-banner'))};});
 assert.ok(m.bubble.left>=0&&m.bubble.right<=m.w+1&&m.bubble.top>=0&&m.bubble.bottom<=m.h+1,label+' bubble bounds');
 for(const r of [...m.targets,m.card,m.boss].filter(Boolean))assert.ok(!overlap(r,m.bubble),label+' no bubble collision '+JSON.stringify(m));
 if(m.card)for(const r of m.targets)assert.ok(!overlap(r,m.card),label+' card leaves teaching target clickable');
 const notice=await p.locator('#toast').evaluate(e=>e.hidden?null:e.getBoundingClientRect().toJSON());if(m.card&&notice)assert.ok(!overlap(notice,m.card),label+' toast leaves card clear');
 measurements.push({label,...m});
}
async function seed(p){await p.evaluate(async()=>{const{createProfile}=await import('/src/core/MetaProgression.ts'),{WEAPONS}=await import('/src/config/weapons.ts'),{PROPS}=await import('/src/config/props.ts');const v=createProfile();Object.assign(v,{tutorialCompleted:true,coins:9999,stars:86,highestStars:86,wins:41,matches:50,winStreak:4,bestWinStreak:9,freeLotteryTickets:3,unlockedWeapons:Object.keys(WEAPONS),ownedProps:Object.fromEntries(Object.keys(PROPS).map(id=>[id,PROPS[id].maxLevel])),equippedWeapons:{kungfu_po:'m10_bamboo_staff'},equippedActiveProps:['milk_bottle','glue_trap'],equippedPassiveProps:['gold_doge','auto_shovel'],selectedMap:'sunny_backyard'});localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(v));});await p.reload({waitUntil:'networkidle'});}
try{
 for(const[label,viewport,mobile]of[['desktop',{width:1280,height:720},false],['mobile-landscape',{width:844,height:390},true]]){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1}),p=await context.newPage();lastPage=p;p.setDefaultTimeout(10000);
  p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});await p.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await seed(p);
  for(const[name,open,close]of[['armory','armory','close-meta'],['compendium-en','recipes','close-recipes'],['settings','settings','close-profile'],['market','market','close-meta']]){
   await action(p,open);if(name==='compendium-en')await action(p,'en');await fit(p,label+'-'+name);
   if(name==='armory'){
    assert.equal(await p.locator('select[data-weapon]').count(),36);
   }
   if(name==='compendium-en'){
    const tabs=await p.locator('.encyclopedia-tabs').evaluate(e=>({w:e.clientWidth,sw:e.scrollWidth,buttons:[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect().toJSON()),r:e.getBoundingClientRect().toJSON()}));assert.equal(tabs.buttons.length,6);assert.ok(tabs.sw<=tabs.w+1,'All six English tabs visible');
    const headings=await p.locator('.compendium-detail .book-growth th').evaluateAll(es=>es.map(e=>({text:e.textContent,white:getComputedStyle(e).whiteSpace,word:getComputedStyle(e).wordBreak})));assert.equal(headings[0].white,'nowrap');assert.equal(headings[1].white,'nowrap');
   }
   if(name==='settings'){
    assert.equal(await p.locator('#game-dialog .language-switch').count(),1);
    await p.locator('input[data-setting="musicVolume"]').evaluate(e=>{e.value='0.73';e.dispatchEvent(new Event('input',{bubbles:true}));});await settle(p);
    assert.equal(await p.locator('input[data-setting="musicVolume"]').evaluate(e=>e.style.getPropertyValue('--range-fill')),'73%');
    const s=await p.locator('.ledger-body').evaluate(e=>({h:e.clientHeight,sh:e.scrollHeight}));assert.ok(s.sh<=s.h+2,label+' settings entirely visible '+JSON.stringify(s));
   }
   if(name==='market')assert.ok(await p.locator('.market-awning [data-action="meta-refresh"]').isVisible());
   await shot(p,`p6-${label}-${name}.png`);
   if(name==='armory'){
    await p.locator('[data-action="meta-equip:m01_swatter:kungfu_po"]').scrollIntoViewIfNeeded();await settle(p);await shot(p,`p6-${label}-armory-chips.png`);
    await action(p,'meta-equip:m01_swatter:kungfu_po');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedWeapons.kungfu_po),'m01_swatter');await action(p,'meta-equip:m01_swatter:kungfu_po');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedWeapons.kungfu_po),undefined);
   }
   if(name==='compendium-en'){await p.locator('.compendium-detail .book-growth tr').last().scrollIntoViewIfNeeded();await settle(p);await shot(p,`p6-${label}-compendium-growth.png`);await action(p,'zh-CN');}
   await action(p,close);
  }
  mark(label+': polished pages, complete English tabs/growth headings, one-screen settings');
  await action(p,'settings');await action(p,'tutorial-replay');
  for(let step=1;step<=3;step++){
   await p.locator(`[data-tutorial-step="${step}"]`).waitFor();await guideFit(p,label+'-step'+step);
   if(step===1)await action(p,'summon','#stage');else{await target(p,'source');await target(p,'target');}
  }
  await p.locator('[data-tutorial-step="4"]').waitFor();await target(p,'source');await guideFit(p,label+'-step4-bench-selected');await shot(p,`p6-${label}-tutorial4-deploy.png`);
  await target(p,'target');assert.equal(await p.locator('.tutorial-bubble').getAttribute('data-tutorial-step'),'4');await target(p,'source');await guideFit(p,label+'-step4-hat-selected-panda-onboard');await shot(p,`p6-${label}-tutorial4-merge.png`);
  await target(p,'target');await p.locator('[data-tutorial-step="5"]').waitFor();assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.kind==='kungfu_po').location.zone),'board');
  const coins=await p.evaluate(()=>window.__CAPY_DEBUG__.profile.coins);await action(p,'recipes','#battle-hud');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),coins+20);await action(p,'close-recipes');mark(label+': tutorial deploy → board hero, measured live-card avoidance, first +20');
  await p.evaluate(()=>{window.__CAPY_DEBUG__.start();const e=window.__CAPY_DEBUG__.engine;e.summon();e.state.units=[];['panda','hat_bamboo','hamster','hamster','shovel'].forEach(id=>e.grant(id));e.state.sides.player.food=200;e.state.sides.player.loot=['m01_swatter','m01_swatter','m10_bamboo_staff'];});await settle(p);
  await tap(p,265,623);assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.lockedBenchSlot),0);await tap(p,1180,580);assert.ok(await p.locator('.redraw-hero-badge').isVisible());assert.ok(await p.locator('#early-wave-button').isVisible());await shot(p,`p6-${label}-strategy-lock-hints.png`);
  const id=await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.location.zone==='bench'&&u.location.slot===0).id);await action(p,'summon','#stage');assert.equal(await p.locator('#summon-refresh-count').textContent(),'↻4');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.location.zone==='bench'&&u.location.slot===0).id),id);
  await tap(p,1180,580);await tap(p,298,656);await action(p,'toggle-bench-lock','#stage');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.lockedBenchSlot),null);
  await action(p,'early-wave','#stage');assert.ok(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.spawned)>0);assert.equal(await p.locator('#early-wave-button').isVisible(),false);
  await action(p,'pause','#stage');await fit(p,label+'-pause');assert.equal((await p.locator('#game-dialog').innerHTML()).match(/<section>/g).length,1);await shot(p,`p6-${label}-pause.png`);
  await action(p,'settings');await action(p,'close-profile');assert.ok(await p.locator('.pause-shell').isVisible());await action(p,'en');await fit(p,label+'-pause-en');await action(p,'zh-CN');await action(p,'surrender');await p.locator('.result-loss').waitFor();await fit(p,label+'-defeat');await shot(p,`p6-${label}-defeat.png`);
  await action(p,'start');
  // Controlled battle fixture: real effective-damage recorder, merge lineage and
  // normal result/persistence path. No fabricated BattleResult or MVP object.
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.oranges=50;const id=e.grant('kungfu_po').unitId;e.move(id,{zone:'board',col:2,row:1});const unit=e.state.units.find(u=>u.id===id);for(let i=0;i<10;i++){e.spawnEnemy(i%3===0?'husky_wrecker':'rat','player');for(const enemy of [...e.state.enemies])e.hurt(enemy,enemy.hp*5,unit);e.skipWave();}e.state.sides.player.loot.push('m01_swatter','m10_bamboo_staff');e.skipWave();});
  await p.locator('.result-win').waitFor();assert.ok(await p.locator('.result-mvp-card').innerText().then(s=>s.includes('功夫阿宝')));await fit(p,label+'-victory');
  const summary=await p.locator('.result-summary-grid').evaluate(e=>({bottom:e.getBoundingClientRect().bottom,limit:e.closest('.ledger-body').getBoundingClientRect().bottom}));assert.ok(summary.bottom<=summary.limit+1,label+' rewards and MVP fit first viewport');
  await shot(p,`p6-${label}-victory.png`);await action(p,'en');await fit(p,label+'-victory-en');await shot(p,`p6-${label}-victory-en.png`);await action(p,'menu');
  mark(label+': real lock/reroll/card unlock, horn, illustrated pause/defeat/victory and MVP');await context.close();lastPage=null;
 }
 const portrait=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),phone=await portrait.newPage();lastPage=phone;
 phone.on('pageerror',e=>errors.push(e.message));phone.on('console',e=>{if(e.type()==='error')errors.push(e.text());});await phone.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await seed(phone);
 await action(phone,'settings');await action(phone,'tutorial-replay');await action(phone,'summon','#stage');
 for(let step=2;step<=3;step++){await target(phone,'source');await target(phone,'target');}
 await target(phone,'source');await guideFit(phone,'portrait-step4-card-toast');await shot(phone,'p6-mobile-portrait-tutorial4.png');mark('Portrait390×844: tutorial above stage, live card below, toast safely above the board');await portrait.close();lastPage=null;
 assert.deepEqual(errors,[]);mark('Console/pageerror: 0');
}catch(e){failure=e.stack;console.error(e);if(lastPage)await shot(lastPage,'p6-failure.png').catch(()=>{});}
finally{await browser.close();fs.writeFileSync(path.join(out,'p6-browser-report.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,screenshots,measurements,passed:!failure&&!errors.length,failure},null,2));}
if(failure||errors.length)process.exitCode=1;
