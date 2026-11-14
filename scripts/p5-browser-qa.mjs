import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const checks=[],errors=[],screenshots=[],measurements=[];let failure;
const mark=text=>{checks.push(text);console.log('PASS '+text);};
const delay=page=>page.waitForTimeout(120);
async function action(page,name,scope){
 scope??=await page.locator('#game-dialog').evaluate(el=>el.open)?'#game-dialog':'#menu-screen';
 await page.locator(`${scope} [data-action="${name}"]`).filter({visible:true}).first().click();await delay(page);
}
async function shot(page,name){await page.screenshot({path:path.join(output,name)});screenshots.push(name);}
async function canvasTap(page,x,y){const r=await page.locator('#battle-canvas').boundingBox();await page.mouse.click(r.x+x/1280*r.width,r.y+y/720*r.height);await delay(page);}
async function ledgerFit(page,label){
 const result=await page.evaluate(()=>{
  const dialog=document.querySelector('#game-dialog'),header=dialog.querySelector('.ledger-header'),tabs=dialog.querySelector('.ledger-tabs'),body=dialog.querySelector('.ledger-body');
  const r=e=>e.getBoundingClientRect().toJSON();
  const clip=[...dialog.querySelectorAll('.ledger-body,.market-stall,.market-backpack')].map(e=>({name:e.className,w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight}));
  return {label:dialog.dataset,viewport:{w:innerWidth,h:innerHeight},dialog:r(dialog),header:r(header),tabs:r(tabs),body:r(body),clip,text:dialog.textContent,headings:[...header.querySelectorAll('h2,p')].map(r)};
 });
 assert.ok(result.dialog.left>=0&&result.dialog.right<=result.viewport.w+1&&result.dialog.top>=0&&result.dialog.bottom<=result.viewport.h+1,label+' viewport');
 assert.ok(result.body.height>80,label+' usable body');
 assert.ok(result.header.bottom<=result.tabs.top+1&&result.tabs.bottom<=result.body.top+1,label+' fixed bands');
 for(const c of result.clip)assert.ok(c.sw<=c.w+2,label+' no horizontal clipping '+JSON.stringify(c));
 assert.doesNotMatch(result.text,/(?:p5|p3|m3|m2|hint|hero|weapon|prop)\.[a-z_]+/);
 for(const selector of ['.ledger-body','.market-stall','.market-backpack']){
  const loc=page.locator(`#game-dialog ${selector}`);if(!await loc.count())continue;
  const scroll=await loc.evaluate(el=>{el.style.scrollBehavior='auto';el.scrollTop=el.scrollHeight;return{actual:el.scrollTop,max:el.scrollHeight-el.clientHeight};});
  assert.ok(Math.abs(scroll.actual-scroll.max)<2,`${label} bottom reachable ${selector}`);
  await loc.evaluate(el=>{el.scrollTop=0;});
 }
 measurements.push({label,...result});
}
async function guideFit(page,label){
 const g=await page.evaluate(()=>{
  const bubble=document.querySelector('.tutorial-bubble').getBoundingClientRect();
  const targets=[...document.querySelectorAll('[data-tutorial-target]')].map(e=>e.getBoundingClientRect().toJSON());
  return{bubble:bubble.toJSON(),targets,w:innerWidth,h:innerHeight,step:document.querySelector('.tutorial-bubble').dataset.tutorialStep};
 });
 assert.ok(g.bubble.left>=0&&g.bubble.right<=g.w+1&&g.bubble.top>=0&&g.bubble.bottom<=g.h+1,label+' bubble inside');
 for(const r of g.targets)assert.ok(!(r.left<g.bubble.right&&r.right>g.bubble.left&&r.top<g.bubble.bottom&&r.bottom>g.bubble.top),label+' bubble avoids target '+JSON.stringify(g));
 measurements.push({label,...g});
}
try{
 for(const [label,viewport,mobile] of [['desktop',{width:1280,height:720},false],['mobile-landscape',{width:844,height:390},true]]){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   const {createProfile}=await import('/src/core/MetaProgression.ts'),{WEAPONS}=await import('/src/config/weapons.ts'),{PROPS}=await import('/src/config/props.ts'),{AVATARS}=await import('/src/config/avatars.ts');
   const p=createProfile();Object.assign(p,{coins:9999,freeLotteryTickets:3,stars:180,highestStars:180,tutorialCompleted:true,unlockedWeapons:Object.keys(WEAPONS),ownedProps:Object.fromEntries(['milk_bottle','glue_trap','gold_doge','auto_shovel','extra_oranges','emp_jammer','promo_badge','tall_perch'].map(id=>[id,PROPS[id].maxLevel])),equippedWeapons:Object.fromEntries(Object.values(WEAPONS).filter(w=>w.signatureHero).map(w=>[w.signatureHero,w.id])),unlockedAvatars:Object.keys(AVATARS),mergedHeroes:['kungfu_po','ronin_goose'],wins:41,matches:50,winStreak:4,bestWinStreak:9,equippedActiveProps:['milk_bottle','glue_trap'],equippedPassiveProps:['gold_doge','auto_shovel','extra_oranges','emp_jammer','promo_badge','tall_perch']});
   localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(p));
  });await page.reload({waitUntil:'networkidle'});
  for(const [name,open,close] of [['compendium','recipes','close-recipes'],['armory','armory','close-meta'],['market','market','close-meta'],['lottery','market','close-meta'],['rank','leaderboard','close-profile'],['profile','profile','close-profile'],['settings','settings','close-profile']]){
   await action(page,open);if(name==='lottery')await action(page,'meta-tab:lottery');
   await ledgerFit(page,`${label}-${name}`);await shot(page,`p5-${label}-${name}.png`);
   if(name==='lottery'){
    await page.locator('.gacha-machine-frame').scrollIntoViewIfNeeded();await delay(page);await shot(page,`p5-${label}-lottery-machine.png`);
    const bounds=await page.locator('.lottery-grid').evaluate(grid=>{const g=grid.getBoundingClientRect(),p=grid.closest('.market-stall').getBoundingClientRect();return{top:g.top,bottom:g.bottom,parentTop:p.top,parentBottom:p.bottom};});
    assert.ok(bounds.top>=bounds.parentTop-1&&bounds.bottom<=bounds.parentBottom+1,'All nine lottery cells visible together '+JSON.stringify(bounds));
   }
   if(name==='compendium'){
    await page.locator('.compendium-detail .book-growth tr').last().scrollIntoViewIfNeeded();await delay(page);await shot(page,`p5-${label}-compendium-growth.png`);
   }
   if(name==='armory'){
    const equip=page.locator('[data-action="meta-equip:m01_swatter:kungfu_po"]');await equip.scrollIntoViewIfNeeded();await delay(page);
    const armoryScroll=await page.locator('.ledger-body').evaluate(el=>el.scrollTop);assert.ok(armoryScroll>0);
    await action(page,'meta-equip:m01_swatter:kungfu_po');assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedWeapons.kungfu_po),'m01_swatter');await shot(page,`p5-${label}-armory-equip.png`);
    assert.ok(Math.abs(await page.locator('.ledger-body').evaluate(el=>el.scrollTop)-armoryScroll)<2,'Equip preserves the weapon card scroll position');
    await action(page,'meta-equip:m01_swatter:kungfu_po');assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.equippedWeapons.kungfu_po),undefined);
   }
   if(name==='lottery'){
    await action(page,'meta-spin');await page.locator('.lottery-result').waitFor();assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.freeLotteryTickets),2);
   }
   if(name==='market'){
    const last=page.locator('.inventory-grid .inventory-prop').last();await last.scrollIntoViewIfNeeded();
    const beforeScroll=await page.locator('.market-backpack').evaluate(el=>el.scrollTop);assert.ok(beforeScroll>0);
    await last.click();await delay(page);
    assert.ok(Math.abs(await page.locator('.market-backpack').evaluate(el=>el.scrollTop)-beforeScroll)<2,'Equip preserves independent backpack scroll');
   }
   await action(page,'en');await ledgerFit(page,`${label}-${name}-en`);if(name==='compendium'||name==='settings')await shot(page,`p5-${label}-${name}-en.png`);
   await action(page,'zh-CN');await action(page,close);
  }
  mark(label+': all seven ledger states, two languages, scroll endpoints, equip toggle and ticket transaction');
  await action(page,'settings');await action(page,'profile');await action(page,'leaderboard');await action(page,'settings');
  // Replay is a real fresh battle with the guaranteed pack, even for high-rank profiles.
  await action(page,'tutorial-replay');
  for(let step=1;step<=5;step++){
   await page.locator(`[data-tutorial-step="${step}"]`).waitFor();await guideFit(page,`${label}-step${step}`);await shot(page,`p5-${label}-tutorial-${step}.png`);
   assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.spawned),0);
   if(step===1)await action(page,'summon','#stage');
   if(step===2){await canvasTap(page,298,656);await canvasTap(page,432,228);}
   if(step===3){await canvasTap(page,402,656);await canvasTap(page,432,228);}
   if(step===4){await canvasTap(page,506,656);await canvasTap(page,610,656);}
  }
  const before=await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins);
  await action(page,'recipes','#battle-hud');assert.equal(await page.locator('#game-dialog').evaluate(el=>el.open),true);
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),before+20);await action(page,'close-recipes');
  // Board taps cancel on an empty pad; dragging still moves it.
  await canvasTap(page,432,228);assert.equal(await page.locator('#live-unit-card').isVisible(),true);
  await canvasTap(page,640,228);assert.equal(await page.locator('#live-unit-card').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.kind==='hamster').location.col),2);
  await action(page,'prop:milk_bottle','#stage');
  const canvas=await page.locator('#battle-canvas').boundingBox(),point=(x,y)=>({x:canvas.x+x/1280*canvas.width,y:canvas.y+y/720*canvas.height});
  const from=point(432,228),to=point(640,228);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();await delay(page);
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.kind==='hamster').location.col),4);
  assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.propCooldowns.milk_bottle??0),0,'Animal dragging must not spend a selected prop');
  await action(page,'pause','#stage');await action(page,'settings');const id=await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.id);
  await action(page,'tutorial-replay');assert.notEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.id),id);await action(page,'summon','#stage');
  assert.deepEqual(await page.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.map(u=>u.kind)),['hamster','hamster','panda','hat_bamboo','squirrel']);
  await action(page,'tutorial-skip','#stage');assert.equal(await page.evaluate(()=>window.__CAPY_DEBUG__.profile.coins),before+20);
  mark(label+': five actual guide steps, unblocked targets, +20 once, safe board taps and in-battle replay');
  await context.close();
 }
 assert.deepEqual(errors,[]);mark('Console/pageerror: 0');
}catch(e){failure=e.stack;console.error(e);}
finally{await browser.close();fs.writeFileSync(path.join(output,'p5-browser-report.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,failure,screenshots,measurements,passed:!failure&&!errors.length},null,2));}
if(failure||errors.length)process.exitCode=1;
