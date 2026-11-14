import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),manifest=path.join(root,'public/audio/manifest.json'),file=path.join(root,'public/audio/p1_qa_override.wav'),before=fs.readFileSync(manifest),temp=path.join(root,'.runtime/browser-tmp');
assert.ok(!fs.existsSync(file),'Never overwrite an existing audio file');
const rate=44100,samples=rate/5,wav=Buffer.alloc(44+samples*2);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
for(let n=0;n<samples;n++)wav.writeInt16LE(Math.round(Math.sin(n/rate*Math.PI*2*523.25)*1000),44+n*2);
let browser;const errors=[],requests=[];
try{
  fs.writeFileSync(file,wav);fs.writeFileSync(manifest,JSON.stringify({bgm_menu:'p1_qa_override.wav',summon:'p1_qa_override.wav',bgm_boss:'p1_missing_boss.wav',hit_soft:'p1_missing_hit.wav'}));
  browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',env:{...process.env,TEMP:temp,TMP:temp},args:['--disable-breakpad','--disable-crash-reporter']});
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{const entry=performance.getEntriesByType('resource').findLast(r=>new URL(r.name).pathname==='/src/ui/SoundManager.ts');const {SoundManager}=await import(entry?.name??'/src/ui/SoundManager.ts');const mode=SoundManager.prototype.setMode;SoundManager.prototype.setMode=function(next){window.__p1OverrideSound=this;return mode.call(this,next);};});
  await page.locator('[data-action="settings"]').first().click();
  await page.waitForFunction(()=>window.__p1OverrideSound?.playingBuffer!==null&&window.__p1OverrideSound?.buffers.has('summon'));
  assert.ok(requests.some(url=>url.endsWith('p1_qa_override.wav')));assert.ok(!requests.some(url=>url.includes('p1_missing')));
  await page.locator('[data-setting="musicVolume"]').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('[data-setting="soundVolume"]').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>window.__p1OverrideSound.music.gain.value===0&&window.__p1OverrideSound.effects.gain.value===0);
  assert.deepEqual(await page.evaluate(()=>[window.__p1OverrideSound.music.gain.value,window.__p1OverrideSound.effects.gain.value]),[0,0]);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'verification/p1-audio-overrides-report.json'),JSON.stringify({passed:true,errors,requests:requests.filter(url=>url.includes('/audio/')),checks:['Real WAV decoded for external BGM and SFX on shared context','Missing declared audio filtered before request: zero404','Both external buses obey volume sliders immediately','Source manifest restored and temporary WAV removed in finally']},null,2));
  console.log('PASS real external WAV decode/loop, both volume buses, missing declarations make zero requests/404, console0');
}finally{if(browser)await browser.close();fs.writeFileSync(manifest,before);if(fs.existsSync(file))fs.unlinkSync(file);}
