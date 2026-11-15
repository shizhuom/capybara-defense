import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=temp;process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter','--disable-background-networking']});
const checks=[],errors=[],screenshots=[],measurements=[];let failure,lastPage;
const settle=p=>p.waitForTimeout(180),mark=s=>{checks.push(s);console.log('PASS '+s);};
async function action(p,name,scope){scope??=await p.locator('#game-dialog').evaluate(e=>e.open)?'#game-dialog':'#menu-screen';await p.locator(`${scope} [data-action="${name}"]`).filter({visible:true}).first().click();await settle(p);}
async function shot(p,name){await p.screenshot({path:path.join(out,name)});screenshots.push(name);}
async function tap(p,x,y,down=false){const r=await p.locator('#battle-canvas').boundingBox();await p.mouse.move(r.x+x/1280*r.width,r.y+y/720*r.height);if(down)await p.mouse.down();else await p.mouse.click(r.x+x/1280*r.width,r.y+y/720*r.height);await settle(p);}
async function seed(p){await p.evaluate(async()=>{
 const{createProfile}=await import('/src/core/MetaProgression.ts'),{WEAPONS}=await import('/src/config/weapons.ts'),{RECIPES}=await import('/src/config/recipes.ts');
 const profile=createProfile();Object.assign(profile,{coins:9999,stars:86,wins:24,matches:30,winStreak:4,bestWinStreak:7,tutorialCompleted:true,tutorialRewardClaimed:true,selectedMap:'sunny_backyard',freeLotteryTickets:3,unlockedWeapons:Object.keys(WEAPONS),mergedHeroes:RECIPES.slice(0,5).map(r=>r.hero),ownedProps:{washer:1,milk_bottle:1,gold_doge:1,auto_shovel:1,extra_oranges:1,bee_overtime:1},equippedWeapons:{kungfu_po:'m10_bamboo_staff'},equippedActiveProps:['washer','milk_bottle'],equippedPassiveProps:['gold_doge','auto_shovel']});
 profile.settings.musicVolume=profile.settings.soundVolume=0;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.setItem('capybara_defense_v1:language','zh-CN');
 });await p.reload({waitUntil:'networkidle'});await settle(p);}
async function page(viewport){const context=await browser.newContext({viewport,reducedMotion:'reduce'}),p=await context.newPage();lastPage=p;p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await seed(p);return{p,context};}
async function guideTarget(p,part){const r=await p.locator(`[data-tutorial-target="${part}"]`).boundingBox();assert.ok(r);await p.mouse.click(r.x+r.width/2,r.y+r.height/2);await settle(p);}
async function fit(p,label){
 const m=await p.evaluate(()=>{const d=document.querySelector('#game-dialog'),r=e=>e?.getBoundingClientRect().toJSON();return{w:innerWidth,h:innerHeight,dialog:r(d),header:r(d.querySelector('.ledger-header')),body:r(d.querySelector('.ledger-body')),footer:r(d.querySelector('.settlement-actions')),text:d.textContent,scroll:[...d.querySelectorAll('.ledger-body,.market-stall,.market-backpack,.encyclopedia-tabs')].map(e=>({name:e.className,w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight}))};});
 assert.ok(m.dialog.left>=0&&m.dialog.right<=m.w+1&&m.dialog.top>=0&&m.dialog.bottom<=m.h+1,label+' viewport');assert.ok(m.body.height>70,label+' scroll body');assert.ok(m.header.bottom<=m.body.top+1,label+' header separate');
 if(m.footer){
  assert.ok(m.body.bottom<=m.footer.top+1&&m.footer.bottom<=m.dialog.bottom,label+' footer');
  const sizes=await p.locator('.settlement-actions>.button').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(sizes.every(n=>n>=(label.startsWith('desktop')?18:16)),label+' readable primary actions: '+sizes);
 }
 for(const s of m.scroll)assert.ok(s.sw<=s.w+2,label+' horizontal overflow '+JSON.stringify(s));
 assert.equal(await p.locator('#game-dialog .dialog-language,#game-dialog [data-action="zh-CN"],#game-dialog [data-action="en"]').count(),0);
 const tiny=await p.locator('#game-dialog').evaluate(d=>[...d.querySelectorAll('*')].filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden="true"],svg,.equip-hero')&&[...e.childNodes].some(n=>n.nodeType===3&&/[a-zA-Z\d\u3400-\u9fff]/.test(n.textContent))&&parseFloat(getComputedStyle(e).fontSize)<13.5).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.trim().slice(0,70),font:getComputedStyle(e).fontSize})));
 if(label.startsWith('desktop'))assert.deepEqual(tiny,[],label+' readable typography');
 assert.doesNotMatch(m.text,/(?:p[1-7]|m[23]|hero|weapon|prop|unit)\.[a-z_]+/);
 await p.locator('.ledger-body').evaluate(e=>{e.style.scrollBehavior='auto';e.scrollTop=e.scrollHeight;});
 await settle(p);assert.ok(await p.locator('.ledger-body').evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop<3),label+' reachable end');
 await p.locator('.ledger-body').evaluate(e=>e.scrollTop=0);measurements.push({label,...m});
}
async function canvasLog(p){await p.evaluate(()=>{
 window.__p7texts=[];const proto=CanvasRenderingContext2D.prototype;if(!window.__p7originalText){window.__p7originalText=proto.fillText;proto.fillText=function(...args){window.__p7texts.push(String(args[0]));if(window.__p7texts.length>5000)window.__p7texts.splice(0,1000);return window.__p7originalText.apply(this,args);};}
 });}
async function fixture(p,kind='hero'){
 await p.evaluate(kind=>{const e=window.__CAPY_DEBUG__.engine;e.state.units=[];e.state.enemies=[];e.state.waveTime=0;e.state.spawned=0;e.state.sides.player.food=80;e.state.sides.player.lockedBenchSlot=null;
  const add=(name,col,row)=>{const id=e.grant(name).unitId;if(col!==undefined){e.state.grid[row][col]='O';e.move(id,{zone:'board',col,row});}return id;};
  add(kind==='hero'?'panda':'hamster',2,1);add(kind==='hero'?'cat':'hamster',5,2);add(kind==='hero'?'hat_bamboo':'hamster');add('squirrel',6,1);add('bee',2,3);
 },kind);await tap(p,1200,710);await canvasLog(p);await settle(p);
}
try{
 {
  const{p,context}=await page({width:1920,height:1080});
  for(const lang of ['zh-CN','en']){
   await action(p,lang);const title=await p.locator('.art-title').boundingBox(),stage=await p.locator('#stage').boundingBox();
   assert.ok(title.width>1100&&Math.abs(title.width/stage.width-.62)<.002);assert.equal(await p.locator('.art-title').evaluate(e=>getComputedStyle(e).maxWidth),'none');
   await shot(p,`p7-start-screen-${lang==='zh-CN'?'zh':'en'}-1080p.png`);
  }mark('1080p title scales to 62% with working menu-only languages');await context.close();
 }
 for(const [label,viewport]of [['desktop',{width:1280,height:720}],['mobile-landscape',{width:844,height:390}],['mobile-portrait',{width:390,height:844}]]){
  const{p,context}=await page(viewport);await shot(p,`p7-${label}-menu.png`);
  await action(p,'recipes');
  for(const[tab,count]of [['pets',19],['heroes',12],['bosses',17],['weapons',36],['props',20]]){
   await action(p,'book:'+tab);assert.equal(await p.locator('.portrait-tile').count(),count);assert.equal(await p.locator('#book-content .book-growth,#book-content .book-stat-pills').count(),0);
   assert.doesNotMatch(await p.locator('.encyclopedia-tabs').innerText(),/\d/);await fit(p,label+'-'+tab);
   if(label==='desktop'&&['heroes','bosses','weapons'].includes(tab))await shot(p,`p7-compendium-${tab}-portraits.png`);
   const id=await p.locator('.portrait-tile').first().getAttribute('data-entry');await action(p,'compendium-entry:'+id);
   assert.equal(await p.locator('.compendium-detail-sheet').count(),1);assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-action')),'compendium-back');await fit(p,label+'-'+tab+'-detail');
   if(label==='desktop'&&tab==='heroes')await shot(p,'p7-compendium-hero-detail.png');
   if(label!=='desktop'&&tab==='heroes')await shot(p,`p7-${label}-hero-detail.png`);
   await action(p,'compendium-next');await action(p,'compendium-prev');assert.equal(await p.locator('.compendium-detail-sheet').getAttribute('data-entry'),id);
   await action(p,'compendium-back');assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-action')),'compendium-entry:'+id);
  }
  await action(p,'book:matrix');await fit(p,label+'-matrix');await action(p,'close-recipes');
  for(const[name,close]of [['armory','close-meta'],['market','close-meta'],['leaderboard','close-profile'],['profile','close-profile'],['settings','close-profile']]){
   await action(p,name);await fit(p,label+'-'+name);if(label==='desktop')await shot(p,`p7-${name}-large-font.png`);
   else await shot(p,`p7-${label}-${name}.png`);
   if(name==='market'){
    await action(p,'meta-tab:lottery');await fit(p,label+'-lottery');await shot(p,`p7-${label}-lottery.png`);
    const tickets=await p.evaluate(()=>window.__CAPY_DEBUG__.profile.freeLotteryTickets);await action(p,'meta-spin');await p.waitForFunction(n=>window.__CAPY_DEBUG__.profile.freeLotteryTickets===n-1,tickets);await p.locator('[data-action="meta-spin"]:not([disabled])').waitFor();
    await action(p,'meta-tab:shop');
   }
   await action(p,close);
  }
  await action(p,'en');await action(p,'recipes');await fit(p,label+'-en-matrix');await action(p,'book:heroes');await action(p,'compendium-entry:kungfu_po');await fit(p,label+'-en-detail');await shot(p,`p7-${label}-en-detail.png`);await action(p,'close-recipes');
  for(const[name,close]of [['armory','close-meta'],['market','close-meta'],['leaderboard','close-profile'],['profile','close-profile'],['settings','close-profile']]){await action(p,name);await fit(p,label+'-en-'+name);await action(p,close);}
  await action(p,'zh-CN');await action(p,'start');await fixture(p);
  await tap(p,298,656,true);assert.ok(await p.evaluate(()=>window.__p7texts.includes('→ 功夫阿宝')&&window.__p7texts.includes('→ 靴子剑客喵')),'press without 9px movement immediately previews both heroes');
  if(label==='desktop')await shot(p,'p7-battle-merge-multi-highlight.png');else await shot(p,`p7-${label}-merge-highlight.png`);
  await p.mouse.up();await settle(p);assert.ok(await p.locator('#live-unit-card').isVisible());
  await action(p,'inspect-book:hat_bamboo','#stage');assert.equal(await p.locator('.compendium-detail-sheet').getAttribute('data-entry'),'hat_bamboo');await action(p,'compendium-hero:puss_in_hat');assert.equal(await p.locator('.compendium-detail-sheet').getAttribute('data-entry'),'puss_in_hat');await action(p,'close-recipes');
  await tap(p,1200,710);await tap(p,298,656);await tap(p,432,228);assert.ok(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.some(u=>u.kind==='kungfu_po'&&u.location.zone==='board')));
  await fixture(p,'upgrade');await tap(p,298,656);assert.ok(await p.evaluate(()=>window.__p7texts.includes('▲ 升至 Lv.2')));if(label==='desktop')await shot(p,'p7-battle-upgrade-highlight.png');
  await action(p,'pause','#stage');await fit(p,label+'-pause');await shot(p,`p7-${label}-pause.png`);await action(p,'surrender');await p.locator('.result-loss').waitFor();await fit(p,label+'-result');await shot(p,`p7-${label}-result.png`);await action(p,'menu');
  await action(p,'start');await p.evaluate(()=>{
   const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.oranges=50;const id=e.grant('kungfu_po').unitId;e.move(id,{zone:'board',col:2,row:1});const unit=e.state.units.find(u=>u.id===id);
   for(let i=0;i<10;i++){e.spawnEnemy('rat','player');for(const enemy of [...e.state.enemies])e.hurt(enemy,enemy.hp*5,unit);e.skipWave();}e.skipWave();
  });await p.locator('.result-win').waitFor();await fit(p,label+'-victory');await shot(p,`p7-${label}-victory.png`);await action(p,'menu');
  // Preserve P5/P6 hands-on tutorial and free single-slot lock behavior.
  await action(p,'settings');await action(p,'tutorial-replay');await action(p,'summon','#stage');
  await p.locator('[data-tutorial-step="2"]').waitFor();await guideTarget(p,'source');await guideTarget(p,'target');
  await p.locator('[data-tutorial-step="3"]').waitFor();await guideTarget(p,'source');await guideTarget(p,'target');
  await p.locator('[data-tutorial-step="4"]').waitFor();await guideTarget(p,'source');await guideTarget(p,'target');
  assert.equal(await p.locator('.tutorial-bubble').getAttribute('data-tutorial-step'),'4');await guideTarget(p,'source');await guideTarget(p,'target');
  await p.locator('[data-tutorial-step="5"]').waitFor();assert.ok(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.some(u=>u.kind==='kungfu_po'&&u.location.zone==='board')));await action(p,'recipes','#battle-hud');await action(p,'close-recipes');
  await fixture(p);await tap(p,265,623);assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.lockedBenchSlot),0);
  const id=await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.find(u=>u.location.zone==='bench'&&u.location.slot===0).id);await action(p,'summon','#stage');assert.equal(await p.locator('#summon-refresh-count').textContent(),'↻4');assert.ok(await p.evaluate(id=>window.__CAPY_DEBUG__.engine.state.units.some(u=>u.id===id),id));
  mark(label+': five galleries/details/focus, all pages bilingual, press preview/tap merge, lottery, pause/victory/defeat, board-hero tutorial and locked reroll');await context.close();lastPage=null;
 }
 assert.deepEqual(errors,[]);
}catch(error){failure=String(error.stack??error);console.error(failure);if(lastPage&&!lastPage.isClosed())await shot(lastPage,'p7-failure.png');}
finally{await browser.close();fs.writeFileSync(path.join(out,'p7-browser-report.json'),JSON.stringify({at:new Date().toISOString(),passed:!failure&&errors.length===0,checks,errors,measurements,screenshots,failure},null,2));}
if(failure||errors.length)process.exitCode=1;
