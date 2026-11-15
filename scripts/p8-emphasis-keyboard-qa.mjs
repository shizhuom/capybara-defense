import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';import {auditDialogText} from './browser-style-audit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});process.env.TEMP=process.env.TMP=temp;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],issues=[],errors=[];let failure;
try{
 const probe=await browser.newPage();await probe.setContent('<style>.equip-hero{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}.equip-hero:focus-within{width:auto;height:auto;clip-path:none;overflow:visible}</style><dialog open id="game-dialog" style="color:#111;background:#fff;font-weight:700"><label class="equip-hero">Equipment<select style="font-weight:500;color:#aaa;background:#fff"><option>Visible native choice</option></select></label></dialog>');
 const hidden=await auditDialogText(probe);assert.equal(hidden.checked,0);await probe.locator('select').focus();const shown=await auditDialogText(probe);
 if(!shown.issues.some(r=>r.text==='Visible native choice'))issues.push('Audit must detect low-contrast/thin selected option when the native equipment control is focused');await probe.close();
 for(const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:2560,height:1440}]){
  const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await p.evaluate(async()=>{const{createProfile}=await import('/src/core/MetaProgression.ts');const profile=createProfile();profile.unlockedWeapons=['m01_swatter'];profile.tutorialCompleted=true;localStorage.setItem('capybara_defense_v1:profile',JSON.stringify(profile));});await p.reload({waitUntil:'networkidle'});
  const action=async id=>{await p.locator(`[data-action="${id}"]`).filter({visible:true}).first().click();};
  await action('armory');await p.locator('select[data-weapon="m01_swatter"]').focus();const report=await auditDialogText(p);
  if(!report.runs.some(r=>r.selector.startsWith('select')))issues.push(viewport.width+': visible equipment select absent from audit');
  issues.push(...report.issues.map(r=>viewport.width+': '+JSON.stringify(r)));
  const tabs=await p.locator('#game-dialog .ledger-tabs button').evaluateAll(es=>es.map(e=>Number(getComputedStyle(e).fontWeight)));
  if(tabs.some(n=>n<800))issues.push(viewport.width+': ledger tabs need weight 800, saw '+tabs);
  await action('close-meta');await action('recipes');await action('book:heroes');await action('compendium-entry:kungfu_po');
  const headings=await p.locator('.book-growth th').evaluateAll(es=>es.map(e=>Number(getComputedStyle(e).fontWeight)));
  if(headings.some(n=>n<800))issues.push(viewport.width+': growth table headings need weight 800, saw '+headings);
  const sizes=await p.locator('#game-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return{width:r.width,height:r.height,overflow:d.querySelector('.ledger-body').scrollWidth>d.querySelector('.ledger-body').clientWidth+2};});
  assert.equal(sizes.overflow,false);checks.push({viewport,tabs,headings,sizes,nativeSelect:report.runs.filter(r=>r.selector.startsWith('select'))});
  if(viewport.width===2560)await p.screenshot({path:path.join(root,'verification/p8-1440p-compendium-bold.png')});await p.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(issues,[]);console.log('PASS emphasis hierarchy, focused native control audit and 1440p scaling');
}catch(e){failure=String(e.stack);throw e;}finally{await browser.close();fs.writeFileSync(path.join(root,'verification/p8-emphasis-keyboard-report.json'),JSON.stringify({checks,issues,errors,failure},null,2));}
