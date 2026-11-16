import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const url=process.env.CAPY_TEST_URL??'http://127.0.0.1:4175/';
const bathsOnly=process.argv.includes('--baths-only');
const errors=[],checks=[],layouts=[],screenshots=[];let failure;
async function act(p,id){await p.locator(`[data-action="${id}"]`).filter({visible:true}).first().click();await p.waitForTimeout(90);}
async function shot(p,name){await p.screenshot({path:path.join(out,`${name}.png`)});screenshots.push(name+'.png');}
async function seed(p,stars=20,map='sunny_backyard'){
 await p.evaluate(async({stars,map})=>{
  const{createProfile}=await import('/src/core/MetaProgression.ts');const a=createProfile();
  Object.assign(a,{stars,highestStars:stars,tutorialCompleted:true,tutorialRewardClaimed:true,selectedMap:map,mergedHeroes:['kungfu_po'],unlockedWeapons:['m10_bamboo_staff'],weaponFragments:{m10_bamboo_staff:20},ownedProps:{washer:1},coins:200,freeLotteryTickets:1});
  a.settings.musicVolume=a.settings.soundVolume=0;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(a));localStorage.removeItem('capybara_defense_v1:normalProfileBackup');
 },{stars,map});await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});
}
async function layout(p,label){
 const r=await p.locator('#game-dialog').evaluate(d=>{
  const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const root=box(d),body=box(d.querySelector('.ledger-body')),footer=box(d.querySelector('.storybook-footer-tip'));
  const tab=d.querySelector('.ledger-tabs'),buttons=[...tab.querySelectorAll('button')].map(box),mascot=box(d.querySelector('.ledger-mascot'));
  const row=d.querySelector('.portrait-tile-button,.storybook-recipe-list button');const children=row?[...row.children].map(box):[];
  const selectors=['.ledger-body','.ledger-tabs','.portrait-tile-button','.storybook-copy','.compendium-detail-sheet','.detail-showcase','.detail-stats','.book-growth','.compendium-detail-bar'];
  const overflows=selectors.flatMap(s=>[...d.querySelectorAll(s)].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({selector:s,client:e.clientWidth,scroll:e.scrollWidth})));
  const broken=[...d.querySelectorAll('img')].filter(e=>e.complete&&e.naturalWidth===0).map(e=>e.src);
  return{root,body,footer,buttons,mascot,children,row:row?box(row):null,overflows,broken,viewport:{width:innerWidth,height:innerHeight},header:getComputedStyle(d.querySelector('.ledger-header')).backgroundColor};
 });layouts.push({label,...r});
 assert.ok(r.root.left>=0&&r.root.right<=r.viewport.width+1&&r.root.top>=0&&r.footer.bottom<=r.viewport.height+1,label+' folder and footer fit');
 assert.ok(r.body.height>85,label+' body remains usable');assert.equal(r.buttons.length,6);
 for(const b of r.buttons)assert.ok(b.left>=r.root.left-1&&b.right<=r.root.right+1,label+' all six tabs fit');
 assert.ok(r.mascot.bottom<=r.buttons[0].top+5&&r.mascot.bottom>=r.buttons[0].top-8,label+' mascot paws meet first bookmark');
 if(r.row)assert.ok(r.row.width>=r.body.width*.85,label+' storybook rows fill the folder width');
 assert.deepEqual(r.overflows,[],label+' horizontal overflow');assert.deepEqual(r.broken,[],label+' broken images');
 return r;
}
async function monitor(context,label){const p=await context.newPage();p.on('pageerror',e=>errors.push(label+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(label+': '+m.text());});return p;}
try{
 for(const[label,viewport]of(bathsOnly?[]:[['desktop',{width:1366,height:768}],['landscape',{width:844,height:390}],['portrait',{width:390,height:844}]])){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),p=await monitor(context,label);await p.goto(url,{waitUntil:'networkidle'});await seed(p);
  for(const lang of ['zh-CN','en']){
   await act(p,lang);await act(p,'recipes');await act(p,'book:matrix');await layout(p,`${label}-${lang}-matrix`);await shot(p,`p10-${label}-${lang}-recipes`);
   assert.equal(await p.locator('.storybook-recipe-list button').count(),12);
   await p.locator('.storybook-recipe-list [data-action="compendium-hero:kungfu_po"]').click();await p.waitForTimeout(250);
   assert.equal(await p.locator('.compendium-detail [data-compendium-kind="kungfu_po"] .book-growth tbody tr').count(),5);
   await p.locator('.compendium-detail').scrollIntoViewIfNeeded();await layout(p,`${label}-${lang}-matrix-detail`);await shot(p,`p10-${label}-${lang}-matrix-detail`);
   for(const[tab,count,id]of[['pets',19,'hamster'],['heroes',12,'kungfu_po'],['bosses',17,'husky_wrecker'],['weapons',36,'m10_bamboo_staff'],['props',20,'washer']]){
    await act(p,'book:'+tab);assert.equal(await p.locator('.portrait-tile').count(),count);
    const text=await p.locator('.portrait-tile .storybook-tagline').allTextContents();assert.ok(text.every(t=>t.length>0&&!/[0-9]/.test(t)),tab+' qualitative taglines');
    assert.equal(await p.locator('.portrait-grid .book-stat-pills,.portrait-grid .book-growth').count(),0);
    await layout(p,`${label}-${lang}-${tab}`);if(lang==='zh-CN'||tab==='heroes')await shot(p,`p10-${label}-${lang}-${tab}`);
    await act(p,'compendium-entry:'+id);await layout(p,`${label}-${lang}-${tab}-detail`);
    assert.equal(await p.locator('.compendium-detail-sheet').getAttribute('data-entry'),id);
    if(tab==='heroes'){
     await shot(p,`p10-${label}-${lang}-hero-detail`);
     await p.locator('.book-growth tbody tr').last().scrollIntoViewIfNeeded();
     const visible=await p.locator('.book-growth tbody tr').last().evaluate(e=>{const r=e.getBoundingClientRect(),b=e.closest('.ledger-body').getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom&&r.left>=b.left&&r.right<=b.right;});
     assert.ok(visible,label+' complete final growth row is reachable');await shot(p,`p10-${label}-${lang}-hero-growth`);
    }
    await act(p,'compendium-next');await act(p,'compendium-prev');await act(p,'compendium-back');
    assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-action')),'compendium-entry:'+id);
   }
   await act(p,'close-recipes');
  }
  await seed(p,0);await act(p,'zh-CN');await act(p,'recipes');await act(p,'book:heroes');
  assert.equal(await p.locator('.portrait-tile.locked-roster').count(),10);await shot(p,`p10-${label}-locked-heroes`);
  await act(p,'compendium-entry:pepe_king');assert.equal(await p.locator('.book-growth').count(),0);await layout(p,`${label}-locked-detail`);await act(p,'close-recipes');
  const broken=await p.evaluate(()=>[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));assert.deepEqual(broken,[]);
  checks.push(`${label}: both languages, six tabs, recipe focus, detail/prev/next/back focus, star gates, no overflow/broken PNGs`);await context.close();
 }
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),p=await monitor(context,'baths');await p.goto(url,{waitUntil:'networkidle'});
 for(const[map,x,y]of[['sunny_backyard',1053.5,531],['sakura_onsen',263,490],['midnight_kitchen',1055,323],['cat_tower_maze',1054,325]]){
  await seed(p,300,map);await act(p,'start');await p.locator('#battle-transition').waitFor({state:'hidden'});
  assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.mapId),map,'Requested map is unlocked in the QA profile');
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.phase='paused';e.state.sides.player.oranges=3;
   const c=document.querySelector('#battle-canvas').getContext('2d'),draw=c.drawImage.bind(c);window.__bathDraws=[];c.drawImage=(...args)=>{const img=args[0];if(img?.src?.includes('capybara')){const t=c.getTransform();window.__bathDraws.push({src:img.src,x:t.e,y:t.f,a:t.a,b:t.b,c:t.c,d:t.d});}return draw(...args);};
  });await p.waitForTimeout(100);
  let draws=await p.evaluate(()=>window.__bathDraws);assert.ok(draws.length);assert.ok(draws.every(d=>d.src.endsWith('/capybara_soak.png')&&Math.abs(d.x-x)<.01&&Math.abs(d.y-y)<=1.5));
  await shot(p,`p10-bath-${map}`);
  // Start a zero-life presentation snapshot: paused time must not freeze old flying fruit on the head.
  await p.evaluate(()=>{window.__bathDraws=[];const s=window.__CAPY_DEBUG__.engine.state;s.sides.player.oranges=0;s.id+=':dizzy-preview';});
  await p.waitForFunction(()=>document.querySelector('#orange-value')?.textContent==='×0');
  draws=await p.evaluate(()=>window.__bathDraws);assert.ok(draws.length);assert.ok(draws.every(d=>d.src.endsWith('/capybara_soak_dizzy.png')&&Math.abs(d.x-x)<=1.21&&d.y===y+1&&d.b===0&&d.c===0));
  await shot(p,`p10-bath-${map}-dizzy`);checks.push(`${map}: native water anchor, new soaking PNG only, upright dizzy state`);
 }
 await context.close();
 // Optional art absent: all UI and Canvas remain usable without requesting invalid URLs.
 if(!bathsOnly){
 const offline=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await offline.route('**/assets/sprites/manifest.json',r=>r.fulfill({json:[]}));
 const f=await monitor(offline,'fallback');await f.goto(url,{waitUntil:'networkidle'});await seed(f,20,'sakura_onsen');await act(f,'recipes');await act(f,'book:heroes');
 assert.equal(await f.locator('svg[data-sticker="ui_compendium_peek_capy"]').count(),1);assert.ok(await f.locator('svg[data-sticker="ui_storybook_check"]').count());
 await layout(f,'portrait-offline-fallback');await shot(f,'p10-portrait-offline-storybook');await act(f,'close-recipes');await act(f,'start');await f.locator('#battle-transition').waitFor({state:'hidden'});await shot(f,'p10-portrait-offline-bath');
 checks.push('Missing optional art: frame-free SVG storybook and tub-free Canvas guardian stay usable');await offline.close();
 }assert.deepEqual(errors,[]);
}catch(e){failure=e.stack;throw e;}finally{
 await browser.close();fs.writeFileSync(path.join(out,bathsOnly?'p10-bath-report.json':'p10-browser-report.json'),JSON.stringify({passed:!failure,errors,checks,layouts,screenshots,failure},null,2));
}
