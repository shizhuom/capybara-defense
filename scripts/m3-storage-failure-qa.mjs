import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=path.join(root,'.runtime','browser-tmp');fs.mkdirSync(temp,{recursive:true});
const executablePath=process.env.CAPY_CHROME??[
  path.join(process.env.PROGRAMFILES??'C:/Program Files','Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)']??'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
].find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('Set CAPY_CHROME to an installed Chrome/Edge executable.');
const browser=await chromium.launch({headless:true,executablePath,env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const click=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().click();
const stored=()=>page.evaluate(()=>localStorage.getItem('capybara_defense_v1:profile'));
try {
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  await click('test-enable');const before=await stored();
  assert.equal(JSON.parse(before).stars,180);
  await click('start');
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='capybara_defense_v1:profile')throw new DOMException('Injected quota limit','QuotaExceededError');return original.call(this,key,value);};
  });
  await click('pause');await click('surrender');
  assert.equal(await stored(),before);
  assert.doesNotMatch(await page.locator('.rank-result').innerText(),/20 星底线保护/);
  assert.match(await page.locator('.save-note').innerText(),/未计入进度/);
  await page.locator('#game-dialog [data-action="en"]').click();
  assert.doesNotMatch(await page.locator('.rank-result').innerText(),/20-star floor protection/);
  assert.match(await page.locator('.save-note').innerText(),/not added to your progress/);
  assert.equal(await stored(),before);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'verification','m3-storage-failure-qa.json'),JSON.stringify({passed:true,errors,checks:['High-rank loss with a rejected profile write leaves persisted progress intact','Failed settlement does not claim floor protection or committed progress, in Chinese and English']},null,2));
  console.log('PASS rejected settlement is atomic and its bilingual feedback is accurate');
} finally { await browser.close(); }
