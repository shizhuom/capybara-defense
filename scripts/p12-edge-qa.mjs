import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'verification'),temp=path.join(root,'.runtime/p12-browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const errors=[],checks=[],shots=[];let failure;
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});shots.push(name+'.png');}
async function audit(p,label){const r=await p.locator('#game-dialog').evaluate(d=>{
 const fits=e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;};
 const visible=e=>e.getClientRects().length&&!e.closest('[hidden]');
 return {fits:[...d.querySelectorAll('.pause-storybook-actions,.crest-plaque-body,.crest-stats-drawer,.crest-stage')].filter(visible).every(fits),overflow:[...d.querySelectorAll('.crest-plaque-body,.ledger-body,.loot-tray li,.unlock-gallery,.crest-core-rewards')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({class:e.className,w:e.clientWidth,scroll:e.scrollWidth}))};
});checks.push({label,...r});assert.ok(r.fits,label+' fits');assert.deepEqual(r.overflow,[],label+' horizontal fit');}
try{
 for(const[label,width,height]of[['desktop',1366,768],['landscape',844,390],['portrait',390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await p.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  const rank=await p.evaluate(async()=>{
   const{createProfile}=await import('/src/core/MetaProgression.ts'),{RANKS}=await import('/src/config/ranks.ts'),{WEAPONS,RARITY_RULES}=await import('/src/config/weapons.ts');
   const rank=RANKS.reduce((a,b)=>a.name.en.length>b.name.en.length?a:b),profile=createProfile();
   Object.assign(profile,{stars:rank.minStars,highestStars:rank.minStars,tutorialCompleted:true,tutorialRewardClaimed:true,weaponFragments:Object.fromEntries(Object.values(WEAPONS).map(w=>[w.id,RARITY_RULES[w.rarity].fragments-1]))});profile.settings.musicVolume=profile.settings.soundVolume=0;
   localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));localStorage.setItem('capybara_defense_v1:language','en');return rank.name.en;
  });
  await p.reload({waitUntil:'networkidle'});await p.evaluate(async()=>{const{assets}=await import('/src/render/AssetRegistry.ts');await assets.ready;window.__CAPY_DEBUG__.start();const{WEAPONS,RARITY_RULES}=await import('/src/config/weapons.ts');const e=window.__CAPY_DEBUG__.engine;e.options.autoWaves=false;e.state.sides.player.loot=Object.keys(WEAPONS).flatMap(id=>[id,id]);});
  await p.locator('#battle-hud [data-action="pause"]').click();await p.waitForTimeout(100);await audit(p,label+' full pause');await shot(p,`p12-edge-${label}-pause`);
  assert.equal(await p.locator('.loot-tray li').count(),36);await p.locator('.loot-tray li').last().scrollIntoViewIfNeeded();await audit(p,label+' pause last loot');await shot(p,`p12-edge-${label}-pause-end`);
  await p.locator('#game-dialog .pause-storybook-actions [data-action="resume"]').click();
  await p.evaluate(()=>{const e=window.__CAPY_DEBUG__.engine;e.state.phase='finished';e.state.result={winner:'player',reason:'waves',coins:265,loot:[...e.state.sides.player.loot],playerLoot:[...e.state.sides.player.loot],aiLoot:[],elapsed:250,mvp:{kind:'ronin_goose',level:5,damage:9999999,kills:326}};});
  await p.locator('#game-dialog.result-ledger').waitFor();await p.waitForTimeout(500);await audit(p,label+' longest rank '+rank);await shot(p,`p12-edge-${label}-rank`);
  await p.locator('.btn-stats').click();await audit(p,label+' full report');await shot(p,`p12-edge-${label}-report`);
  assert.equal(await p.locator('.loot-tray li').count(),36);assert.equal(await p.locator('.unlock-gallery>div').count()>=36,true);
  await p.locator('.unlock-gallery>div').last().scrollIntoViewIfNeeded();await audit(p,label+' report end');await shot(p,`p12-edge-${label}-report-end`);
  await p.locator('[data-action="close-result-stats"]').click();assert.equal(await p.locator('.btn-stats').evaluate(e=>e===document.activeElement),true);await context.close();
 }
 assert.deepEqual(errors,[]);
}catch(e){failure=e;console.error(e.stack);}
finally{await browser.close();fs.writeFileSync(path.join(out,'p12-edge-report.json'),JSON.stringify({passed:!failure,checks,shots,errors,failure:failure?.message},null,2));console.log(JSON.stringify({passed:!failure,shots:shots.length}));}
if(failure)process.exitCode=1;
