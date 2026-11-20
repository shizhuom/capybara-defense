// P14 Onsen Kitchen visual QA. Requires the dev server: npm run dev (http://127.0.0.1:4175/).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/p14-browser-tmp');
fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(out,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],layouts=[],shots=[];let failure;
const url='http://127.0.0.1:4175/';
const only=process.argv[2];
const shot=async(p,name)=>{await p.screenshot({path:path.join(out,name+'.png')});shots.push(name+'.png');};
async function click(p,selector){await p.locator(selector).filter({visible:true}).first().click();await p.waitForTimeout(120);}
async function dialogAction(p,id){await click(p,`#game-dialog[open] [data-action="${id}"]`);}
/** Seeds a profile through the app's own modules, then reloads with every sprite decoded. */
async function ready(p,{lang='zh-CN',patch={}}={}){
 await p.goto(url,{waitUntil:'networkidle'});
 await p.evaluate(async({lang,patch})=>{
  const {createProfile}=await import('/src/core/MetaProgression.ts');
  const profile=Object.assign(createProfile(),{stars:20,highestStars:20,selectedMap:'sunny_backyard',tutorialCompleted:true,tutorialRewardClaimed:true,earlyWaveTipSeen:true,coins:420,wins:6,matches:8},patch);
  profile.settings.musicVolume=profile.settings.soundVolume=0;
  localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.setItem('capybara_defense_v1:language',lang);
 },{lang,patch});
 await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});
 await p.waitForTimeout(250);
}
const rect=(p,selector)=>p.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},selector);
const overlaps=(a,b)=>a&&b&&a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
async function noOverflow(p,label,selectors){
 const report=await p.evaluate(sels=>{
  const visible=el=>{const r=el.getBoundingClientRect();return !!(r.width&&r.height)&&!el.closest('[hidden]')&&getComputedStyle(el).visibility!=='hidden';};
  const overflow=sels.flatMap(sel=>[...document.querySelectorAll(sel)].filter(visible).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({sel,cls:String(el.className),width:el.clientWidth,scroll:el.scrollWidth})));
  const scrolled=el=>{const box=el.parentElement?.closest('.ledger-body,.crest-report-body');return !!box&&box!==el;};
  const boxes=sels.flatMap(sel=>[...document.querySelectorAll(sel)].filter(visible).filter(el=>!scrolled(el)).map(el=>{const r=el.getBoundingClientRect();return{sel,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  return{width:innerWidth,height:innerHeight,overflow,boxes,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),
   raw:/\b(?:p14|broth|ingredient)\.[\w.]+/.test(document.body.innerText)};
 },selectors);
 layouts.push({label,...report});
 assert.deepEqual(report.overflow,[],label+' horizontal overflow');assert.deepEqual(report.broken,[],label+' broken image');assert.equal(report.raw,false,label+' raw translation key');
 for(const r of report.boxes)assert.ok(r.x>=-1&&r.y>=-1&&r.right<=report.width+1&&r.bottom<=report.height+1,`${label} out-of-viewport ${r.sel}: ${JSON.stringify(r)}`);
}
async function startScreen(p,name){
 const boxes={};
 for(const sel of ['.profile-pill','.menu-system','.art-title','.start-button','.map-chips','.hub-dock-left','.hub-dock-right','.active-broth-pill','[data-action="kitchen"].kitchen-dock-button'])boxes[sel]=await rect(p,`#menu-screen ${sel}`);
 const buttons=await p.evaluate(()=>[...document.querySelectorAll('#menu-screen .hub-dock button')].map(b=>{const r=b.getBoundingClientRect();return{a:b.dataset.action,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)assert.equal(overlaps(buttons[i],buttons[j]),false,`${name} dock ${buttons[i].a}/${buttons[j].a} overlap`);
 for(const b of buttons){assert.equal(overlaps(b,boxes['.start-button']),false,`${name} dock ${b.a} overlaps Start`);assert.equal(overlaps(b,boxes['.map-chips']),false,`${name} dock ${b.a} overlaps maps`);}
 if(boxes['.active-broth-pill']){
  // The title is a wide transparent image; only its lettering band (x 25%..95% of the box) must stay clear.
  const t=boxes['.art-title'],letters=t&&{...t,x:t.x+t.width*.25,right:t.x+t.width*.95};boxes.letters=letters;boxes.rotate=await rect(p,'.rotate-hint');
  for(const sel of ['.profile-pill','.start-button','.map-chips','.hub-dock-left','.hub-dock-right','.menu-system','letters','rotate'])assert.equal(overlaps(boxes['.active-broth-pill'],boxes[sel]),false,`${name} broth pill overlaps ${sel}`);
 }
 layouts.push({label:name+' start boxes',boxes,buttons});
}
async function battle(p,mapId){
 await p.evaluate(mapId=>{window.__CAPY_DEBUG__.start();const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.state.sides.player.food=300;
  for(const [kind,col,row] of [['hamster',2,1],['panda',3,1],['hat_bamboo',4,1],['squirrel',6,3],['corgi',5,3]]){const r=e.grant(kind);const u=e.state.units.find(u=>u.id===r.unitId);e.state.grid[row][col]='O';u.location={zone:'board',col,row};}
  void mapId;
 },mapId);await p.waitForTimeout(400);
}
const sakuraProfile={stars:180,highestStars:180,selectedMap:'sakura_onsen',ingredients:{ing_yuzu:6,ing_honey:3,ing_bamboo:2,ing_sakura:1},unlockedBroths:['dish_yuzu_bath','dish_sakura_milk','dish_herbal_tonic'],brothLevels:{dish_yuzu_bath:2,dish_sakura_milk:2,dish_herbal_tonic:1},activeBrothId:'dish_sakura_milk',
 equippedPassiveProps:['auto_shovel','extra_oranges'],ownedProps:{auto_shovel:1,extra_oranges:1}};
try{
 for(const [name,width,height] of [['desktop',1366,768],['mobile-landscape',844,390],['mobile-portrait',390,844]]){
  if(only&&only!==name)continue;
  const context=await browser.newContext({viewport:{width,height},hasTouch:name.startsWith('mobile')});const p=await context.newPage();
  p.on('pageerror',e=>errors.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(name+': '+m.text());});

  // 1. Start screen: fresh chef gift makes the pot medallion glow with "可熬制!".
  await ready(p);
  assert.equal(await p.locator('#menu-screen .kitchen-brew-badge').innerText(),'可熬制!');
  await startScreen(p,name+' start fresh');await shot(p,`p14-${name}-1-start-brewable`);

  // 2. Kitchen broths tab, then brew the Yuzu Calm Soak live.
  await click(p,'#menu-screen [data-action="kitchen"]');await p.locator('.kitchen-dialog[open]').waitFor();
  const mascot=await rect(p,'#game-dialog[open] .ledger-mascot'),tab=await rect(p,'#game-dialog[open] .ledger-tabs button');
  assert.ok(Math.abs(mascot.bottom-tab.y)<=6,`${name} chef paws ${mascot.bottom} vs tab top ${tab.y}`);
  assert.equal(await p.locator('#game-dialog[open] .kitchen-row').count(),12);
  await noOverflow(p,name+' kitchen broths',['#game-dialog[open]','#game-dialog[open] .ledger-body','#game-dialog[open] .kitchen-row','#game-dialog[open] .kitchen-active-strip','#game-dialog[open] .storybook-footer-tip']);
  await shot(p,`p14-${name}-2a-kitchen-broths`);
  await dialogAction(p,'kitchen-brew:dish_yuzu_bath');await p.waitForTimeout(250);
  const brewed=await p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
  assert.deepEqual(brewed.unlockedBroths,['dish_yuzu_bath']);assert.equal(brewed.activeBrothId,'dish_yuzu_bath');assert.deepEqual(brewed.ingredients,{});
  assert.ok((await p.locator('#game-dialog[open] .kitchen-aura-badge').innerText()).includes('1/12'));
  await p.locator('#game-dialog[open] .ledger-body').evaluate(el=>{el.scrollTop=0;});
  await shot(p,`p14-${name}-2b-kitchen-brewed-yuzu`);
  checks.push(name+': brewable badge, chef mascot flush on tab, 12 cream rows, live brew persisted + auto-equip + aura badge');

  // 3. Dish detail sheet (Lv.1/2/3 ladder), pantry and the mystery basket.
  await dialogAction(p,'kitchen-dish:dish_yuzu_bath');
  assert.equal(await p.locator('#game-dialog[open] .kitchen-ladder-step').count(),3);
  await noOverflow(p,name+' dish detail',['#game-dialog[open] .ledger-body','#game-dialog[open] .kitchen-detail-sheet','#game-dialog[open] .compendium-detail-bar']);
  await shot(p,`p14-${name}-3a-dish-detail`);
  await p.locator('#game-dialog[open] .ledger-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});await p.waitForTimeout(120);
  await shot(p,`p14-${name}-3b-dish-detail-ladder`);
  await dialogAction(p,'kitchen-tab:pantry');assert.equal(await p.locator('#game-dialog[open] .kitchen-ingredient-row').count(),6);
  await shot(p,`p14-${name}-3c-pantry`);
  await dialogAction(p,'kitchen-basket');await p.waitForTimeout(650);
  assert.equal(await p.locator('#game-dialog[open] .kitchen-basket-result li').count(),3);
  const bought=await p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));assert.equal(bought.coins,360);
  assert.equal(Object.values(bought.ingredients).reduce((a,b)=>a+b,0),3);
  await p.locator('#game-dialog[open] .kitchen-basket-card').scrollIntoViewIfNeeded();await p.waitForTimeout(100);
  await noOverflow(p,name+' pantry basket',['#game-dialog[open] .ledger-body','#game-dialog[open] .kitchen-ingredient-row','#game-dialog[open] .kitchen-basket-card']);
  await shot(p,`p14-${name}-3d-basket-opened`);
  await dialogAction(p,'close-kitchen');await p.waitForTimeout(150);
  assert.ok(await p.locator('#menu-screen .active-broth-pill').isVisible(),name+' active broth pill');
  await startScreen(p,name+' start with pill');await shot(p,`p14-${name}-1b-start-active-pill`);
  checks.push(name+': detail ladder, pantry six rows, 60-coin basket opened 3, start pill without overlap');

  // 4. Battle: pink Sakura Milk water + right-rail pill and tooltip.
  await ready(p,{patch:sakuraProfile});await battle(p,'sakura_onsen');
  assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.mapId),'sakura_onsen');
  assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.oranges),3+2+2);
  await p.locator('#passive-rail .broth-rail-pill').waitFor();
  const rail=await rect(p,'#passive-rail .broth-rail-pill'),heading=await rect(p,'#passive-rail .passive-rail-heading');assert.ok(rail.bottom<=heading.y+2,name+' broth pill above passives');
  await noOverflow(p,name+' battle rail',['#passive-rail']);
  await shot(p,`p14-${name}-4a-battle-sakura-water`);
  await click(p,'#passive-rail .broth-rail-pill');
  assert.equal(await p.locator('#passive-rail .broth-rail-pill').getAttribute('aria-expanded'),'true');
  const tip=await rect(p,'#passive-rail .broth-tooltip');assert.ok(tip&&tip.x>=0&&tip.right<=width&&tip.y>=0&&tip.bottom<=height,`${name} tooltip inside viewport ${JSON.stringify(tip)}`);
  await shot(p,`p14-${name}-4b-broth-tooltip`);
  checks.push(name+': tinted tub water, broth pill above passive rail, tooltip expanded inside viewport');

  // Pause shows collected ingredients.
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.ingredientLoot=['ing_sakura','ing_sakura','ing_honey','ing_mushroom'];});
  await click(p,'#pause-button');await p.locator('.pause-ledger[open] .pause-ingredients').waitFor();
  await noOverflow(p,name+' pause',['#game-dialog[open] .pause-storybook-board','#game-dialog[open] .pause-ingredients']);
  await shot(p,`p14-${name}-4d-pause-ingredients`);await dialogAction(p,'resume');

  // 5. Victory shield + report scroll shelf, then defeat salvage.
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.wave=10;e.state.time=152;e.state.sides.player.loot=['m01_swatter'];
   const u=e.state.units.find(u=>u.kind==='hamster'),enemy=e.spawnEnemy('rat','player');enemy.hp=900;enemy.maxHp=900;e.hurt(enemy,900,u,true);e.state.enemies=[];e.finish('player','waves');});
  await p.locator('.endless-offer-ledger[open]').waitFor();await dialogAction(p,'decline-endless');await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(600);
  assert.ok((await p.locator('#game-dialog[open] .crest-ingredients').innerText()).includes('+'));
  await shot(p,`p14-${name}-5a-victory-shield`);
  await dialogAction(p,'toggle-result-stats');await p.waitForTimeout(300);
  const items=await p.locator('#game-dialog[open] .visual-treasure-item.is-ingredient').count();assert.ok(items>=3,name+' ingredient shelf items '+items);
  await p.locator('#game-dialog[open] .visual-treasure-shelf').scrollIntoViewIfNeeded();
  await noOverflow(p,name+' report',['#game-dialog[open] .visual-report-scroll','#game-dialog[open] .crest-stats-drawer']);
  await shot(p,`p14-${name}-5b-victory-report-shelf`);
  const banked=await p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')).ingredients);
  assert.ok((banked.ing_sakura??0)>=3,name+' victory banked sakura');
  await p.keyboard.press('Escape');await dialogAction(p,'menu');
  await battle(p,'sakura_onsen');
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.ingredientLoot=['ing_sakura','ing_chili','ing_sakura','ing_bamboo','ing_honey'];e.adjustOranges(-99);});
  await p.locator('.result-ledger[open]').waitFor();await p.waitForTimeout(600);
  assert.ok((await p.locator('#game-dialog[open] .crest-ingredients').innerText()).includes('+3'));
  await shot(p,`p14-${name}-5c-defeat-shield`);
  await dialogAction(p,'toggle-result-stats');await p.waitForTimeout(300);
  assert.ok(await p.locator('#game-dialog[open] .ingredient-salvage-note').isVisible());
  await p.locator('#game-dialog[open] .visual-treasure-shelf').scrollIntoViewIfNeeded();
  await noOverflow(p,name+' defeat report',['#game-dialog[open] .visual-report-scroll','#game-dialog[open] .crest-stats-drawer']);
  await shot(p,`p14-${name}-5d-defeat-report-salvage`);
  checks.push(name+': pause ingredient tray, victory crest +ingredients and shelf, defeat salvage +3 with note');

  // English pass over the kitchen.
  await p.keyboard.press('Escape');await dialogAction(p,'menu');await ready(p,{lang:'en'});
  await click(p,'#menu-screen [data-action="kitchen"]');await p.locator('.kitchen-dialog[open]').waitFor();
  await noOverflow(p,name+' kitchen en',['#game-dialog[open] .ledger-body','#game-dialog[open] .kitchen-row','#game-dialog[open] .kitchen-active-strip']);
  await shot(p,`p14-${name}-6-kitchen-en`);
  // Golden and jade soaks on two more native baths.
  if(name==='desktop')for(const [map,broth] of [['sunny_backyard','dish_yuzu_bath'],['midnight_kitchen','dish_herbal_tonic']]){
   await ready(p,{patch:{...sakuraProfile,selectedMap:map,activeBrothId:broth}});await battle(p,map);
   assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.mapId),map);await shot(p,`p14-${name}-4c-battle-${broth}`);
  }
  await context.close();
 }
 assert.deepEqual(errors,[],'runtime errors');
}catch(error){failure=error;console.error(error);const page=browser.contexts().flatMap(c=>c.pages()).at(-1);if(page)await shot(page,'p14-qa-last-failure');}
finally{await browser.close();fs.writeFileSync(path.join(out,'p14-browser-report.json'),JSON.stringify({passed:!failure&&errors.length===0,checks,layouts,shots,errors,failure:failure?.stack},null,2));}
if(failure)process.exitCode=1;else console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:shots.length,errors:errors.length}));
