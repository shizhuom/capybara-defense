import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(temp,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],evidence=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
  // Serve real loopback HTML so Chrome assigns the correct address space to Vite HMR.
  const harness=path.join(root,'.runtime/p3-components.html');
  const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><dialog id="book" class="game-dialog recipe-dialog"></dialog></body></html>';
  if(!fs.existsSync(harness)||fs.readFileSync(harness,'utf8')!==html)fs.writeFileSync(harness,html);
  await page.goto('http://127.0.0.1:4175/.runtime/p3-components.html',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
    await import('/src/ui/styles.css');await import('/src/ui/m2.css');await import('/src/ui/m3.css');await import('/src/ui/p1.css');await import('/src/ui/p3-components.css');
    const [{Compendium},{assets},{createProfile,unlockAllProfile}]=await Promise.all([
      import('/src/ui/Compendium.ts'),import('/src/render/AssetRegistry.ts'),import('/src/core/MetaProgression.ts')]);
    await assets.ready;window.__bookFixture={book:new Compendium(),profile:unlockAllProfile(createProfile())};
    const dialog=document.querySelector('#book');dialog.innerHTML=window.__bookFixture.book.markup(window.__bookFixture.profile);dialog.showModal();
  });
  for(const tab of ['matrix','pets','heroes','bosses','weapons','props']){
    evidence.push(await page.evaluate(tab=>{
      const {book,profile}=window.__bookFixture;book.select(tab);const dialog=document.querySelector('#book');dialog.innerHTML=book.markup(profile);
      return{tab,entries:dialog.querySelectorAll('[data-entry]').length,text:dialog.innerText,rect:dialog.getBoundingClientRect().toJSON(),scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth};
    },tab));
    await page.screenshot({path:path.join(root,`verification/p3-component-${tab}.png`)});
  }
  for(const row of evidence){assert.ok(row.rect.bottom<=900&&row.rect.right<=1440);assert.ok(row.scrollWidth<=row.clientWidth+1,`${row.tab} horizontal overflow`);assert.doesNotMatch(row.text,/\b(?:p1|p3|hero|unit|skill|prop|weapon)\.[a-z_]+/);}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({tabs:evidence.map(({tab,entries})=>({tab,entries})),errors},null,2));
}finally{fs.writeFileSync(path.join(root,'verification/p3-components-report.json'),JSON.stringify({evidence,errors},null,2));await browser.close();}
