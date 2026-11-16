import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {auditDialogText} from './browser-style-audit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist'),out=path.join(root,'verification');
process.env.TEMP=process.env.TMP=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(process.env.TEMP,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
const reports=[],errors=[],checks=[];let failure;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
async function act(p,id){await p.locator(`[data-action="${id}"]`).filter({visible:true}).first().click();await p.waitForTimeout(80);}
async function audit(p,label){
 const storybook=await p.locator('.storybook-footer-tip').count()>0;
 if(!storybook){const r=await auditDialogText(p);reports.push({label,checked:r.checked,minContrast:r.minContrast,minWeight:Math.min(...r.runs.map(run=>run.weight)),issues:r.issues});assert.deepEqual(r.issues,[],label+' retains unchanged settlement typography');}
 else {
  assert.equal(await p.locator('#game-dialog .ledger-tabs').count(),1);
  const thin=await p.locator('#game-dialog').evaluate(d=>[...d.querySelectorAll('span,p,small,strong,b,button,label,output')].filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&Number(getComputedStyle(e).fontWeight)<700).map(e=>e.className));
  assert.deepEqual(thin,[],label+' bold storybook text');
  reports.push({label,storybook:true,thin});
 }
 const fits=await p.locator('#game-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1&&[...d.querySelectorAll('.ledger-body')].every(e=>e.scrollWidth<=e.clientWidth+2);});
 assert.ok(fits,label+' unchanged page fits');
}
try{
 for(const[label,viewport,prefix]of[['desktop',{width:1366,height:768},'/'],['landscape',{width:844,height:390},'/p11-build/game/'],['portrait',{width:390,height:844},'/p11-build/game/']]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),p=await context.newPage(),requests=[];
  p.on('pageerror',e=>errors.push(label+': '+e.message));p.on('console',e=>{if(e.type()==='error')errors.push(label+': '+e.text());});p.on('request',r=>requests.push(new URL(r.url()).pathname));
  // Serve the exact built files under the same allowed origin, without stopping the user's service.
  await context.route('http://127.0.0.1:4175/**',async r=>{
   const pathname=new URL(r.request().url()).pathname;assert.ok(pathname.startsWith(prefix));
   const relative=decodeURIComponent(pathname.slice(prefix.length))||'index.html',file=path.resolve(dist,relative);
   assert.ok(file.startsWith(dist+path.sep));
   await r.fulfill(fs.existsSync(file)?{status:200,contentType:mime[path.extname(file)]??'application/octet-stream',body:fs.readFileSync(file)}:{status:404,body:'Not found'});
  });
  await p.goto('http://127.0.0.1:4175'+prefix,{waitUntil:'networkidle'});
  assert.equal(await p.evaluate(()=>typeof window.__CAPY_DEBUG__),'undefined');
  for(const id of ['capybara_soak','capybara_soak_dizzy','ui_compendium_peek_capy','ui_storybook_check','ui_armory_peek_capy','ui_market_peek_raccoon','ui_rank_peek_capy','ui_profile_peek_capy'])assert.ok(requests.includes(prefix+'assets/sprites/'+id+'.png'));
  assert.equal(new Set(requests.filter(u=>u.endsWith('.png'))).size,209);
  for(const lang of ['zh-CN','en']){
   await act(p,lang);await act(p,'recipes');await act(p,'book:heroes');assert.equal(await p.locator('.portrait-tile.locked-roster').count(),10);
   assert.equal(await p.locator('img[data-sticker="ui_compendium_peek_capy"]').count(),1);
   await act(p,'compendium-entry:kungfu_po');assert.equal(await p.locator('.book-growth tbody tr').count(),5);await act(p,'compendium-back');
   assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-action')),'compendium-entry:kungfu_po');await act(p,'close-recipes');
   for(const[screen,close]of[['armory','close-meta'],['market','close-meta'],['profile','close-profile'],['leaderboard','close-profile'],['settings','close-profile']]){
    await act(p,screen);await audit(p,`${label}-${lang}-${screen}`);await act(p,close);
   }
  }
  await act(p,'zh-CN');await act(p,'start');await p.locator('#battle-transition').waitFor({state:'hidden'});
  await act(p,'summon');await act(p,'tutorial-skip');assert.match(await p.locator('#summon-button').innerText(),/12/);
  await act(p,'pause');await audit(p,label+'-pause');await act(p,'surrender');await audit(p,label+'-defeat');await act(p,'menu');
  const stored=await p.evaluate(()=>localStorage.getItem('capybara_defense_v1:profile'));await p.reload({waitUntil:'networkidle'});
  assert.equal(await p.evaluate(()=>localStorage.getItem('capybara_defense_v1:profile')),stored);
  await act(p,'recipes');await act(p,'book:pets');await p.screenshot({path:path.join(out,`p11-production-${label}.png`)});
  assert.ok(requests.every(r=>r.startsWith(prefix)));checks.push(`${label}: exact production bytes, 209 relative PNGs, no debug bridge, locked/detail/back, shared storybook folders, unchanged pause/result, tutorial/summon and saved profile reload`);await context.close();
 }
 assert.deepEqual(errors,[]);
}catch(e){failure=e.stack;throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'p11-production-report.json'),JSON.stringify({passed:!failure,errors,checks,reports,failure},null,2));}
