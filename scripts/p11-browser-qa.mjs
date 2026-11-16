import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/p11-browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const url=process.env.CAPY_TEST_URL??'http://127.0.0.1:4175/';
const errors=[],layouts=[],checks=[],screenshots=[];let failure;
async function act(p,id){const inDialog=p.locator(`#game-dialog[open] [data-action="${id}"]`).filter({visible:true});await (await inDialog.count()?inDialog:p.locator(`[data-action="${id}"]`).filter({visible:true})).first().click();await p.waitForTimeout(75);}
async function shot(p,name){await p.screenshot({path:path.join(out,`${name}.png`)});screenshots.push(name+'.png');}
async function seed(p){
 await p.evaluate(async()=>{
  const{createProfile}=await import('/src/core/MetaProgression.ts');const a=createProfile();
  const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  Object.assign(a,{stars:21,highestStars:21,tutorialCompleted:true,tutorialRewardClaimed:true,selectedMap:'sunny_backyard',mergedHeroes:['kungfu_po'],unlockedWeapons:['m10_bamboo_staff','m01_swatter'],weaponFragments:{m10_bamboo_staff:15,m01_swatter:25},ownedProps:{washer:1,clay:1,milk_bottle:1,auto_shovel:1,gold_doge:1,promo_badge:1},equippedActiveProps:['clay'],equippedPassiveProps:['auto_shovel'],coins:1000,freeLotteryTickets:2,shop:{day:date,offers:['washer','promo_badge','giant_orange_cat']}});
  a.settings.musicVolume=a.settings.soundVolume=0;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(a));localStorage.removeItem('capybara_defense_v1:normalProfileBackup');
 });await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;});
}
async function monitor(context,label){const p=await context.newPage();p.on('pageerror',e=>errors.push(label+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(label+': '+m.text());});return p;}
async function layout(p,label,tabCount){
 const r=await p.locator('#game-dialog').evaluate(d=>{
  const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const body=d.querySelector('.ledger-body'),tabs=d.querySelectorAll('.ledger-tabs');
  const row=d.querySelector('.storybook-row-button,.shop-row,.prop-row,.leaderboard-row');
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),b=body.getBoundingClientRect();return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'&&r.bottom>b.top&&r.top<b.bottom;};
  const overflows=[...d.querySelectorAll('.ledger-tabs,.ledger-body,.storybook-row-button,.storybook-copy,.storybook-detail-sheet,.storybook-lottery-card,.storybook-loadout-strip,.storybook-volume-control,.storybook-heading-note,.storybook-hero-equip,.storybook-shop-heading,.compendium-detail-bar')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({cls:e.className,client:e.clientWidth,scroll:e.scrollWidth}));
  const thin=[...body.querySelectorAll('p,span,small,b,strong,button,output,label,h3')].filter(e=>visible(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&Number(getComputedStyle(e).fontWeight)<700).map(e=>e.className);
  return{root:box(d),body:box(body),footer:box(d.querySelector('.storybook-footer-tip')),tabs:tabs.length,buttons:[...tabs[0].querySelectorAll('button')].map(box),mascot:box(d.querySelector('.ledger-mascot')),overflows,thin,broken:[...d.querySelectorAll('img')].filter(e=>e.complete&&!e.naturalWidth).map(e=>e.src),row:row?box(row):null,viewport:{width:innerWidth,height:innerHeight},raw:/\bp11\.[\w.]+/.test(d.innerText),background:getComputedStyle(d).backgroundColor,board:getComputedStyle(body).backgroundColor};
 });layouts.push({label,...r});
 assert.ok(r.root.left>=-1&&r.root.right<=r.viewport.width+1&&r.root.top>=-1&&r.footer.bottom<=r.viewport.height+1,label+' folder/footer fit');
 assert.equal(r.tabs,1,label+' one tab bar');assert.equal(r.buttons.length,tabCount);assert.ok(r.body.height>85,label+' useful inner scroll height');
 assert.ok(r.mascot.bottom<=r.buttons[0].top+5&&r.mascot.bottom>=r.buttons[0].top-8,label+' paws aligned');
 for(const b of r.buttons)assert.ok(b.left>=r.root.left&&b.right<=r.root.right+1,label+' tabs fit');
 assert.deepEqual(r.overflows,[],label+' overflow');assert.deepEqual(r.broken,[],label+' images');assert.deepEqual(r.thin,[],label+' bold text');assert.equal(r.raw,false,label+' translations');
 assert.equal(r.background,'rgba(0, 0, 0, 0)');assert.equal(r.board,'rgb(199, 176, 163)');
 assert.equal(await p.locator('#game-dialog .dialog-language').count(),0);
 return r;
}
async function profile(p){return p.evaluate(()=>JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));}
async function focusVisible(p){return p.evaluate(()=>{const e=document.activeElement,b=document.querySelector('#game-dialog .ledger-body').getBoundingClientRect(),r=e.getBoundingClientRect();return {action:e.dataset.action,row:e.closest('.prop-row')?.dataset.propId,visible:r.top>=b.top-1&&r.bottom<=b.bottom+1};});}
async function interactions(){
 const context=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'}),p=await monitor(context,'interactions');await p.goto(url,{waitUntil:'networkidle'});await seed(p);
 await p.evaluate(()=>{const key='capybara_defense_v1:profile',a=JSON.parse(localStorage.getItem(key));delete a.ownedProps.washer;a.ownedProps.promo_badge=1;a.shop.offers=['washer','promo_badge','giant_orange_cat'];localStorage.setItem(key,JSON.stringify(a));});await p.reload({waitUntil:'networkidle'});
 await act(p,'armory');await act(p,'meta-weapon:m10_bamboo_staff');await act(p,'meta-equip:m10_bamboo_staff:kungfu_po');assert.equal((await profile(p)).equippedWeapons.kungfu_po,'m10_bamboo_staff');await shot(p,'p11-interaction-weapon-equipped');
 await act(p,'meta-equip:m10_bamboo_staff:kungfu_po');assert.equal((await profile(p)).equippedWeapons.kungfu_po,undefined);
 await act(p,'meta-equip:m10_bamboo_staff:kungfu_po');await act(p,'meta-weapon-back');assert.equal(await p.evaluate(()=>document.activeElement.dataset.action),'meta-weapon:m10_bamboo_staff');
 await act(p,'meta-family:recycle');await p.locator('input[data-rarity="4"]').uncheck();const beforeRecycle=await profile(p);await act(p,'meta-recycle');const recycled=await profile(p);assert.equal(recycled.coins,beforeRecycle.coins+192);assert.equal(recycled.weaponFragments.m01_swatter,1);assert.equal(recycled.weaponFragments.m10_bamboo_staff,15);await act(p,'close-meta');
 await act(p,'market');const beforeBuy=await profile(p);await act(p,'meta-buy:washer');assert.equal((await profile(p)).coins,beforeBuy.coins-90);assert.equal((await profile(p)).ownedProps.washer,1);
 const trainingPrice=await p.evaluate(async()=>{const{PROPS}=await import('/src/config/props.ts');return PROPS.promo_badge.price;});const beforeUpgrade=await profile(p);await act(p,'meta-buy:promo_badge');assert.equal((await profile(p)).ownedProps.promo_badge,2);assert.equal((await profile(p)).coins,beforeUpgrade.coins-trainingPrice);
 const beforeRefresh=(await profile(p)).coins;await act(p,'meta-refresh');assert.equal((await profile(p)).coins,beforeRefresh-20);
 await act(p,'meta-tab:backpack');await act(p,'meta-prop:washer');assert.deepEqual((await profile(p)).equippedActiveProps,['clay','washer']);
 await p.locator('.prop-row[data-prop-id="milk_bottle"] button').click();assert.deepEqual((await profile(p)).equippedActiveProps,['clay','washer']);
 await p.locator('.prop-row[data-prop-id="clay"] button').click();await p.locator('.prop-row[data-prop-id="milk_bottle"] button').click();assert.deepEqual((await profile(p)).equippedActiveProps,['washer','milk_bottle']);
 const doge=p.locator('.prop-row[data-prop-id="gold_doge"] button');await doge.scrollIntoViewIfNeeded();await doge.focus();await p.keyboard.press('Enter');await p.waitForTimeout(150);
 assert.ok((await profile(p)).equippedPassiveProps.includes('gold_doge'));assert.deepEqual(await focusVisible(p),{action:'meta-prop:gold_doge',row:'gold_doge',visible:true});
 await p.keyboard.press('Enter');await p.waitForTimeout(150);assert.ok(!(await profile(p)).equippedPassiveProps.includes('gold_doge'));assert.equal((await focusVisible(p)).visible,true);await shot(p,'p11-interaction-backpack-keyboard');
 await act(p,'meta-tab:lottery');await p.evaluate(()=>{Math.random=()=>.55;});const beforeTicket=await profile(p);await act(p,'meta-spin:ticket');assert.equal((await profile(p)).freeLotteryTickets,beforeTicket.freeLotteryTickets-1);assert.equal((await profile(p)).coins,beforeTicket.coins+80);await p.locator('.lottery-result').waitFor({state:'visible'});await shot(p,'p11-interaction-lottery-result');
 await p.evaluate(()=>{Math.random=()=>.4;});const beforeCoin=await profile(p);await act(p,'meta-spin:coins');const afterCoin=await profile(p);assert.equal(afterCoin.freeLotteryTickets,beforeCoin.freeLotteryTickets);assert.equal(afterCoin.coins,beforeCoin.coins-120+40,'120 coins paid, 40-coin prize credited');
 // Closing while the paid animation is running must not charge or roll again.
 await act(p,'close-meta');const paid=await profile(p);await p.waitForTimeout(4000);assert.deepEqual(await profile(p),paid);
 await act(p,'profile');await act(p,'avatar:hamster');assert.equal((await profile(p)).avatarId,'hamster');
 await act(p,'settings');await p.locator('[data-setting="musicVolume"]').fill('0.37');assert.equal((await profile(p)).settings.musicVolume,.37);assert.equal(await p.locator('output[for="profile-setting-musicVolume"]').innerText(),'37%');
 await p.locator('[data-setting="showDamageNumbers"]').uncheck();assert.equal((await profile(p)).settings.showDamageNumbers,false);await act(p,'close-profile');const saved=await profile(p);await p.reload({waitUntil:'networkidle'});assert.deepEqual(await profile(p),saved);
 await act(p,'start');await p.locator('#battle-transition').waitFor({state:'hidden'});await act(p,'battle-shop');assert.match(await p.locator('.storybook-footer-tip').innerText(),/本局立即生效/);
 await act(p,'battle-shop:armory');await act(p,'meta-family:all');await act(p,'meta-weapon:m10_bamboo_staff');await act(p,'meta-equip:m10_bamboo_staff:ronin_goose');
 assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.loadout.equippedWeapons.ronin_goose),'m10_bamboo_staff');await act(p,'battle-shop:market');await act(p,'meta-tab:backpack');await p.locator('.prop-row[data-prop-id="gold_doge"] button').click();assert.ok(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.loadout.equippedPassiveProps.includes('gold_doge')));await shot(p,'p11-interaction-preparation-footer');await act(p,'close-meta');
 await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;for(let i=0;i<80&&e.state.spawned===0;i++)e.tick(.5);});await act(p,'battle-shop');assert.match(await p.locator('.storybook-footer-tip').innerText(),/下局生效/);await act(p,'battle-shop:armory');await act(p,'meta-family:all');await act(p,'meta-weapon:m10_bamboo_staff');await act(p,'meta-equip:m10_bamboo_staff:kungfu_po');
 assert.equal((await profile(p)).equippedWeapons.kungfu_po,'m10_bamboo_staff');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.sides.player.loadout.equippedWeapons.ronin_goose),'m10_bamboo_staff');await shot(p,'p11-interaction-next-battle-footer');await act(p,'close-meta');assert.equal(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.phase),'playing');
 await act(p,'pause');assert.equal(await p.locator('.pause-ledger .storybook-footer-tip').count(),0);await shot(p,'p11-pause-regression');await act(p,'settings');await act(p,'tutorial-replay');await p.locator('#battle-transition').waitFor({state:'hidden'});await act(p,'summon');assert.deepEqual(await p.evaluate(()=>window.__CAPY_DEBUG__.engine.state.units.filter(u=>u.location.zone==='bench').map(u=>u.kind)),['hamster','hamster','panda','hat_bamboo','squirrel']);
 checks.push('Transactions: equip/remove, filtered surplus recycle, buy/upgrade/refresh, slot caps, visible row keyboard focus, ticket/coin draw, close-during-spin, avatars/settings/reload, prep live loadout vs combat lock, tutorial replay');await context.close();
}
try{
 const viewports=[['desktop',{width:1366,height:768}],['1080p',{width:1920,height:1080}],['landscape',{width:844,height:390}],['portrait',{width:390,height:844}]];
 for(const[label,viewport] of (process.argv.includes('--interactions-only')?[]:process.argv.includes('--quick')?viewports.slice(0,1):viewports)){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),p=await monitor(context,label);await p.goto(url,{waitUntil:'networkidle'});await seed(p);
  for(const lang of (process.argv.includes('--quick')?['zh-CN']:['zh-CN','en'])){
   await act(p,lang);await act(p,'armory');await act(p,'meta-family:all');
   assert.equal(await p.locator('.weapon-row').count(),36);await shot(p,`p11-${label}-${lang}-armory-list`);await layout(p,`${label}-${lang}-armory`,5);
   await act(p,'meta-weapon:m10_bamboo_staff');await layout(p,`${label}-${lang}-weapon-detail`,5);assert.equal(await p.locator('.storybook-hero-button').count(),4);assert.equal(await p.evaluate(()=>document.activeElement?.dataset.action),'meta-weapon-back');await shot(p,`p11-${label}-${lang}-weapon-detail`);
   await act(p,'meta-weapon-next');await act(p,'meta-weapon-prev');await act(p,'meta-weapon-back');assert.equal(await p.evaluate(()=>document.activeElement?.dataset.action),'meta-weapon:m10_bamboo_staff');
   await act(p,'meta-family:recycle');await layout(p,`${label}-${lang}-recycle`,5);await shot(p,`p11-${label}-${lang}-recycle`);await act(p,'close-meta');
   await act(p,'market');await act(p,'meta-tab:shop');assert.equal(await p.locator('.shop-row').count(),3);assert.equal(await p.locator('.prop-row').count(),0);await layout(p,`${label}-${lang}-shop`,3);await shot(p,`p11-${label}-${lang}-market-deals`);
   await act(p,'meta-tab:backpack');assert.equal(await p.locator('.prop-row').count(),20);assert.equal(await p.locator('.prop-slot').count(),8);await layout(p,`${label}-${lang}-backpack`,3);await shot(p,`p11-${label}-${lang}-backpack`);
   await act(p,'meta-tab:lottery');assert.equal(await p.locator('.lottery-cell').count(),8);await layout(p,`${label}-${lang}-lottery`,3);await shot(p,`p11-${label}-${lang}-lottery`);await act(p,'close-meta');
   for(const screen of ['leaderboard','profile','settings']){
    await act(p,screen);await layout(p,`${label}-${lang}-${screen}`,3);await shot(p,`p11-${label}-${lang}-${screen}`);
    if(screen==='leaderboard')assert.equal(await p.locator('.leaderboard-row').count(),16);
    if(screen==='profile')assert.equal(await p.locator('.avatar-row').count(),16);
    if(screen==='settings')assert.equal(await p.locator('.setting-row').count(),4);
   }await act(p,'close-profile');
   await act(p,'recipes');await act(p,'book:heroes');await layout(p,`${label}-${lang}-compendium`,6);await shot(p,`p11-${label}-${lang}-compendium-regression`);await act(p,'close-recipes');
  }checks.push(`${label}: unified folders, both languages, all tabs, detail navigation, no overflow or broken images`);await context.close();
 }
 if(!process.argv.includes('--quick'))await interactions();
 assert.deepEqual(errors,[]);
}catch(error){failure=String(error.stack??error);console.error(failure);}finally{
 await browser.close();fs.writeFileSync(path.join(out,process.argv.includes('--interactions-only')?'p11-interactions-report.json':'p11-browser-report.json'),JSON.stringify({at:new Date().toISOString(),passed:!failure,checks,layouts,screenshots,errors,failure},null,2));
 console.log(JSON.stringify({passed:!failure,checks:checks.length,layouts:layouts.length,screenshots:screenshots.length,errors:errors.length}));
}
if(failure)process.exitCode=1;
