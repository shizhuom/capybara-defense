import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';import {auditDialogText} from './browser-style-audit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const reports=[],errors=[],screenshots=[],checks=[];let failure;
async function action(p,name){await p.locator(`[data-action="${name}"]`).filter({visible:true}).first().click();await p.waitForTimeout(120);}
async function seed(p){await p.evaluate(async()=>{
 const{createProfile}=await import('/src/core/MetaProgression.ts'),{WEAPONS}=await import('/src/config/weapons.ts'),{PROPS}=await import('/src/config/props.ts');const profile=createProfile();
 Object.assign(profile,{coins:9999,stars:181,wins:45,matches:60,tutorialCompleted:true,tutorialRewardClaimed:true,selectedMap:'sunny_backyard',freeLotteryTickets:3,unlockedWeapons:Object.keys(WEAPONS).slice(0,32),ownedProps:Object.fromEntries(['washer','milk_bottle','clay','auto_shovel','gold_doge','extra_oranges'].filter(id=>PROPS[id]).map(id=>[id,1])),equippedActiveProps:['washer','milk_bottle'],equippedPassiveProps:['auto_shovel','gold_doge'],equippedWeapons:{kungfu_po:'m10_bamboo_staff'}});
 profile.settings.musicVolume=profile.settings.soundVolume=0;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));
 });await p.reload({waitUntil:'networkidle'});}
async function audit(p,label){
 const report=await auditDialogText(p);reports.push({label,...report});console.log(label+': '+report.checked+' text runs, '+report.issues.length+' style failures');
 if(!label.startsWith('mobile'))report.issues.push(...report.runs.filter(r=>r.size<15.5&&/[A-Za-z0-9\u3400-\u9fff]/.test(r.text)).map(r=>({...r,reason:'Desktop label under 15.5px'})));
 const fit=await p.locator('#game-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight,overflow:[...d.querySelectorAll('.ledger-body,.market-stall,.market-backpack,.encyclopedia-tabs')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className)};});
 assert.ok(fit.left>=0&&fit.right<=fit.w+1&&fit.top>=0&&fit.bottom<=fit.h+1,label+' dialog fits');assert.deepEqual(fit.overflow,[],label+' horizontal overflow');
 assert.equal(await p.locator('#game-dialog .dialog-language,#game-dialog [data-action="en"],#game-dialog [data-action="zh-CN"]').count(),0);
 assert.doesNotMatch(await p.locator('#game-dialog').innerText(),/(?:p[1-8]|m[23]|hero|weapon|prop|unit|fragment)\.[a-z_]+/);
 const clippedTabs=await p.locator('.encyclopedia-tabs button').evaluateAll(bs=>bs.flatMap(b=>[...b.children].flatMap(e=>{const r=document.createRange();r.selectNodeContents(e);const t=e.tagName==='SPAN'?r.getBoundingClientRect():e.getBoundingClientRect(),s=b.getBoundingClientRect();return t.left<s.left-1||t.right>s.right+1||t.top<s.top-1||t.bottom>s.bottom+1?[b.textContent.trim()]:[];})));
 assert.deepEqual(clippedTabs,[],label+' readable tabs');
 for(const e of await p.locator('.ledger-body,.market-stall,.market-backpack').all()){
  await e.evaluate(e=>{e.style.scrollBehavior='auto';e.scrollTop=e.scrollHeight;});await p.waitForTimeout(40);assert.ok(await e.evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop<3),label+' scroll end');await e.evaluate(e=>e.scrollTop=0);
 }
}
async function shot(p,name){await p.screenshot({path:path.join(out,name)});screenshots.push(name);}
async function victory(p){await action(p,'start');await p.evaluate(()=>{
 const e=window.__CAPY_DEBUG__.engine;e.state.sides.player.oranges=50;const id=e.grant('kungfu_po').unitId;e.move(id,{zone:'board',col:2,row:1});const u=e.state.units.find(u=>u.id===id);
 for(let i=0;i<9;i++){e.spawnEnemy('rat','player');for(const m of [...e.state.enemies])e.hurt(m,m.hp*5,u);e.skipWave();}e.state.sides.player.loot=['m05_duster','m02_slipper','m12_iron_wok','w01_teaser'];e.skipWave();
 });await p.locator('.result-win').waitFor();}
async function tap(p,x,y){const r=await p.locator('#battle-canvas').boundingBox();await p.mouse.click(r.x+x/1280*r.width,r.y+y/720*r.height);await p.waitForTimeout(160);}
async function crowded(p,label){
 await action(p,'start');await p.evaluate(()=>{
  const e=window.__CAPY_DEBUG__.engine;e.state.units=[];e.state.enemies=[];e.setTutorialHold(true);e.state.sides.player.food=90;
  const add=(kind,col,row)=>{const id=e.grant(kind).unitId;e.state.grid[row][col]='O';e.move(id,{zone:'board',col,row});return e.state.units.find(u=>u.id===id);};
  add('goose',2,1);add('cleaver',4,1);add('squirrel',1,3);
  for(let row=0;row<5;row++)for(let col=0;col<9;col++)if(['G','O'].includes(e.state.grid[row][col])&&!e.state.units.some(u=>u.location.col===col&&u.location.row===row)&&e.state.units.length<16){add(['hamster','hedgehog','corgi','bee'][e.state.units.length%4],col,row).level=5;}
  const c=CanvasRenderingContext2D.prototype;if(!window.__p8original){const clear=c.clearRect,text=c.fillText;c.clearRect=function(...args){window.__p8text=[];return clear.apply(this,args);};c.fillText=function(...args){window.__p8text??=[];window.__p8text.push(String(args[0]));return text.apply(this,args);};window.__p8original=true;}
 });await tap(p,328,436);await p.waitForTimeout(180);
 assert.ok(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.length>=14));assert.ok(await p.locator('#live-unit-card').innerText().then(t=>t.includes('松鼠')||t.includes('Squirrel')));
 assert.ok(await p.evaluate(()=>window.__p8text.filter(t=>t==='可合!').length>=2),label+' passive badges with unrelated selection');
 const badge=p.locator('#redraw-hero-badge');await badge.waitFor({state:'visible'});assert.match(await badge.innerText(),/无名刀鹅/);
 const r=await badge.boundingBox(),v=p.viewportSize();assert.ok(r.x>=0&&r.x+r.width<=v.width+1&&r.y>=0&&r.y+r.height<=v.height,label+' locator fits');
 await shot(p,label==='1080p'?'p8-crowded-board-passive-special-merge.png':`p8-${label}-crowded-merge.png`);
 await badge.click();await p.waitForTimeout(160);assert.ok(await p.evaluate(()=>window.__p8text.includes('→ 无名刀鹅')),label+' click locator targets board-board special recipe');
 await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;for(const [kind,col,row]of [['rooster',6,2],['basketball',7,2]]){e.state.units=e.state.units.filter(u=>u.location.zone!=='board'||u.location.col!==col||u.location.row!==row);e.state.grid[row][col]='O';e.move(e.grant(kind).unitId,{zone:'board',col,row});}});
 await badge.click();await p.waitForTimeout(160);assert.ok(await p.evaluate(()=>window.__p8text.includes('→ 铁山靠鸡神')),label+' locator cycles another recipe');
 await badge.click();await p.waitForTimeout(160);assert.ok(await p.evaluate(()=>window.__p8text.includes('→ 无名刀鹅')),label+' locator cycles back');
 checks.push(label+' crowded passive + unrelated selection + locator cycling');
 await action(p,'pause');await audit(p,label+'-pause');await shot(p,`p8-${label}-pause.png`);await action(p,'surrender');await p.locator('.result-loss').waitFor();await audit(p,label+'-defeat');await action(p,'menu');
}
try{
 const probe=await browser.newPage();await probe.setContent('<dialog open id="game-dialog" style="background:#fff;color:#111;font-weight:700"><p style="font-weight:500">thin</p><p style="opacity:.45">faded</p><p style="background:linear-gradient(#fff,#111)">gradient</p><p>legible</p></dialog>');
 const probeAudit=await auditDialogText(probe);assert.deepEqual(probeAudit.issues.map(r=>r.text).sort(),['faded','gradient','thin']);await probe.close();checks.push('Auditor catches thin text, ancestor opacity and weakest gradient stop');
 for(const [label,viewport]of [['1080p',{width:1920,height:1080}],['720p',{width:1280,height:720}],['mobile-landscape',{width:844,height:390}],['mobile-portrait',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await seed(p);
  for(const lang of ['zh-CN','en']){
   await action(p,lang);await victory(p);await audit(p,label+'-'+lang+'-victory');
   if(label==='1080p'){
    const sizes=await p.locator('.loot-tray li>span,.result-star-change small,.result-mvp-card>span,.result-rewards small').evaluateAll(es=>es.map(e=>({text:e.textContent,size:parseFloat(getComputedStyle(e).fontSize),weight:Number(getComputedStyle(e).fontWeight)})));
    assert.ok(sizes.every(s=>s.size>=21&&s.weight>=800),'1080p settlement labels >=21px/800: '+JSON.stringify(sizes));
   }
   await shot(p,`p8-${label}-${lang==='zh-CN'?'victory-bold-contrast':'en-victory'}.png`);await action(p,'menu');
   await action(p,'recipes');await audit(p,label+'-'+lang+'-matrix');
   for(const [tab,count]of [['pets',19],['heroes',12],['bosses',17],['weapons',36],['props',20]]){
    await action(p,'book:'+tab);assert.equal(await p.locator('.portrait-tile').count(),count);await audit(p,label+'-'+lang+'-'+tab+'-portraits');
    const id=await p.locator('.portrait-tile').first().getAttribute('data-entry');await action(p,'compendium-entry:'+id);await audit(p,label+'-'+lang+'-'+tab+'-detail');
    if(tab==='heroes')await shot(p,`p8-${label}-${lang==='zh-CN'?'compendium-detail-bold':'en-detail'}.png`);
    await action(p,'compendium-next');await action(p,'compendium-prev');assert.equal(await p.locator('.compendium-detail-sheet').getAttribute('data-entry'),id);await action(p,'compendium-back');assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-action')),'compendium-entry:'+id);
   }await action(p,'close-recipes');
   for(const [name,close]of [['armory','close-meta'],['market','close-meta'],['leaderboard','close-profile'],['profile','close-profile'],['settings','close-profile']]){
    await action(p,name);await audit(p,label+'-'+lang+'-'+name);if(lang==='zh-CN')await shot(p,`p8-${label}-${name}-bold-contrast.png`);
    if(name==='market'){await action(p,'meta-tab:lottery');await audit(p,label+'-'+lang+'-lottery');await action(p,'meta-spin');await p.locator('[data-action="meta-spin"]:not([disabled])').waitFor();await audit(p,label+'-'+lang+'-lottery-prize');await action(p,'meta-tab:shop');}
    await action(p,close);
   }
   if(lang==='en'){await action(p,'start');await action(p,'pause');await audit(p,label+'-en-pause');await action(p,'surrender');await p.locator('.result-loss').waitFor();await audit(p,label+'-en-defeat');await action(p,'menu');}
  }
  await action(p,'zh-CN');await crowded(p,label);await context.close();
 }
 assert.deepEqual(errors,[]);assert.ok(reports.every(r=>!r.issues.length),'Style failures: '+JSON.stringify(reports.filter(r=>r.issues.length).map(r=>({label:r.label,issues:r.issues.slice(0,5)}))));
 console.log('PASS all '+reports.length+' bilingual dialog audits + crowded merge checks');
}catch(e){failure=e.stack;throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'p8-browser-report.json'),JSON.stringify({passed:!failure&&!errors.length,reports,errors,checks,screenshots,failure},null,2));}
