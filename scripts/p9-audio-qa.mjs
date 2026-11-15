import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'verification'),temp=path.join(root,'.runtime/browser-tmp');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(temp,{recursive:true});
process.env.TEMP=process.env.TMP=temp;
const report={date:new Date().toISOString(),origin:'http://127.0.0.1:4175',kind:'Real headless Chromium AudioContext PCM, not physical iOS verification',checks:[],errors:[],modes:[],cues:[],media:[]};
let browser,failure;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CAPY_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-breakpad','--disable-crash-reporter']});
  const context=await browser.newContext(),page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.route('**/__p9_audio_qa__',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>P9 audio measurement</title><link rel="icon" href="data:,"><button id="unlock">Unlock audio</button>'}));
  await page.goto(`${report.origin}/__p9_audio_qa__`,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
    const owned=new Set(),edges=new Map();let managerCreates=true;
    const nativeConnect=AudioNode.prototype.connect,nativeDisconnect=AudioNode.prototype.disconnect;
    AudioNode.prototype.connect=function(...args){const result=nativeConnect.apply(this,args);let targets=edges.get(this);if(!targets){targets=new Set();edges.set(this,targets);}targets.add(args[0]);return result;};
    AudioNode.prototype.disconnect=function(...args){const result=nativeDisconnect.apply(this,args);if(args.length===0)edges.delete(this);else edges.get(this)?.delete(args[0]);return result;};
    for(const name of ['createGain','createOscillator','createBiquadFilter','createBufferSource','createDynamicsCompressor']){
      const native=AudioContext.prototype[name];AudioContext.prototype[name]=function(...args){const node=native.apply(this,args);if(managerCreates)owned.add(node);return node;};
    }
    const {SoundManager}=await import('/src/ui/SoundManager.ts');
    const m=new SoundManager({musicVolume:.5,soundVolume:.75,showDamageNumbers:true});
    document.querySelector('#unlock').addEventListener('click',event=>{window.__audio.trustedGestures.push(event.isTrusted);window.__audio.unlockPromise=m.unlock();});
    window.__audio={m,owned,edges,trustedGestures:[],unlockPromise:null,chunks:[],capturing:false,recorders:[],managerCreates:value=>{managerCreates=value;}};
  });
  await page.locator('#unlock').click();
  await page.evaluate(async()=>{
    const q=window.__audio;await q.unlockPromise;const c=q.m.context;
    if(!q.m.isUnlocked())throw new Error('Trusted click did not unlock the real AudioContext');
    q.managerCreates(false);
    q.analyser=c.createAnalyser();q.analyser.fftSize=2048;q.analyser.smoothingTimeConstant=0;
    q.stream=c.createMediaStreamDestination();q.m.makeup.connect(q.analyser);q.m.makeup.connect(q.stream);
    const code=`class PCMTap extends AudioWorkletProcessor {process(inputs){const data=inputs[0]?.[0];if(data){const copy=new Float32Array(data);this.port.postMessage(copy,[copy.buffer]);}return true;}}registerProcessor('p9-pcm-tap',PCMTap);`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));await c.audioWorklet.addModule(url);URL.revokeObjectURL(url);
    q.tap=new AudioWorkletNode(c,'p9-pcm-tap');q.silent=c.createGain();q.silent.gain.value=0;
    q.m.makeup.connect(q.tap);q.tap.connect(q.silent);q.silent.connect(c.destination);
    q.tap.port.onmessage=event=>{if(q.capturing)q.chunks.push(event.data);};q.managerCreates(true);
    q.recordStart=()=>{
      if(typeof MediaRecorder==='undefined')return null;
      const type=['audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));if(!type)return null;
      const recorder=new MediaRecorder(q.stream.stream,{mimeType:type}),chunks=[];
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.start();q.recorders.push(recorder);return {recorder,chunks,type};
    };
    q.recordStop=recording=>new Promise(resolve=>{
      if(!recording){resolve(null);return;}
      recording.recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(recording.chunks,{type:recording.type}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve({base64:btoa(binary),mime:recording.type,bytes:bytes.length});};recording.recorder.stop();
    });
    q.measure=async(milliseconds)=>{
      q.chunks=[];q.capturing=true;const bands=new Float32Array(q.analyser.frequencyBinCount),spectra=[],observedFamilies=new Map();
      let reduction=0;const started=c.currentTime;
      const poll=setInterval(()=>{q.analyser.getFloatFrequencyData(bands);spectra.push(Array.from(bands));reduction=Math.min(reduction,q.m.compressor.reduction);for(const voice of q.m.voices){const name=voice.source instanceof OscillatorNode?voice.source.type:'noise/buffer';if(!observedFamilies.has(name))observedFamilies.set(name,new Set());observedFamilies.get(name).add(voice.source);}},20);
      await new Promise(resolve=>setTimeout(resolve,milliseconds));clearInterval(poll);q.capturing=false;
      let peak=0,sum=0,samples=0,clipped=0,silent=0,longestSilence=0;
      for(const chunk of q.chunks)for(const value of chunk){const abs=Math.abs(value);peak=Math.max(peak,abs);sum+=value*value;samples++;if(abs>=.9999)clipped++;if(abs<.0001){silent++;longestSilence=Math.max(longestSilence,silent);}else silent=0;}
      let energy=0,phone=0,weighted=0;const bins=new Float64Array(bands.length);
      for(const spectrum of spectra)for(let i=1;i<spectrum.length;i++){const hz=i*c.sampleRate/q.analyser.fftSize;if(hz<80||hz>12000)continue;const power=10**(spectrum[i]/10);energy+=power;weighted+=hz*power;bins[i]+=power;if(hz>=800&&hz<=3200)phone+=power;}
      const dominant=Array.from(bins,(power,bin)=>({frequency:Math.round(bin*c.sampleRate/q.analyser.fftSize),power})).sort((a,b)=>b.power-a.power).slice(0,8).map(({frequency})=>frequency);
      const families=Object.fromEntries([...observedFamilies].map(([name,sources])=>[name,sources.size]));
      return {peak,rms:Math.sqrt(sum/Math.max(1,samples)),clippedSamples:clipped,samples,renderedSeconds:samples/c.sampleRate,contextSeconds:c.currentTime-started,longestSilenceSeconds:longestSilence/c.sampleRate,phoneBandEnergyRatio:phone/Math.max(energy,1e-20),spectralCentroidHz:weighted/Math.max(energy,1e-20),dominantHz:dominant,minimumCompressorReductionDb:reduction,voiceFamilies:families,liveVoices:q.m.voices.size};
    };
  });
  // AudioParam.value reflects the render quantum, not the queued automation call.
  await page.waitForTimeout(350);
  report.host=await page.evaluate(()=>{const {m}=window.__audio,c=m.context;return {userAgent:navigator.userAgent,sampleRate:c.sampleRate,currentTime:c.currentTime,state:c.state,defaultSettings:m.settings,graph:{music:m.music.gain.value,effects:m.effects.gain.value,threshold:m.compressor.threshold.value,knee:m.compressor.knee.value,ratio:m.compressor.ratio.value,attack:m.compressor.attack.value,release:m.compressor.release.value,makeup:m.makeup.gain.value},trustedGestures:window.__audio.trustedGestures};});
  for(const [key,wanted] of Object.entries({music:.325,effects:.8625,threshold:-10,knee:12,ratio:4,attack:.003,release:.16,makeup:1.35}))assert.ok(Math.abs(report.host.graph[key]-wanted)<.00001,`${key} rendered graph setting`);
  report.checks.push('Trusted click unlocks real AudioContext; both default buses feed configured compressor and makeup');
  async function media(recording,label){if(recording){const file=`p9-audio-${label}.webm`;fs.writeFileSync(path.join(out,file),Buffer.from(recording.base64,'base64'));report.media.push({file,bytes:recording.bytes,mime:recording.mime});}}
  for(const mode of ['menu','battle','boss']){
    const result=await page.evaluate(async(mode)=>{
      const q=window.__audio;q.m.setMusicPaused(true);q.m.setMode(mode);q.m.setMusicPaused(false);
      await new Promise(resolve=>setTimeout(resolve,260));const recording=q.recordStart(),measurement=await q.measure(3300);
      return {mode,...measurement,recording:await q.recordStop(recording)};
    },mode);
    await media(result.recording,mode);delete result.recording;report.modes.push(result);
    assert.ok(result.samples>100000,`${mode} real PCM rendered`);assert.ok(result.rms>.012,`${mode} audible RMS`);assert.ok(result.peak<.9999,`${mode} no clipped peak`);assert.equal(result.clippedSamples,0);assert.ok(result.longestSilenceSeconds<.4,`${mode} no long silence`);assert.ok(result.phoneBandEnergyRatio>.03,`${mode} phone-band harmonics`);
    console.log(`${mode}: RMS ${result.rms.toFixed(4)}, peak ${result.peak.toFixed(4)}, 800–3200Hz ${(100*result.phoneBandEnergyRatio).toFixed(1)}%`);
    const wrap=await page.evaluate(async()=>{const q=window.__audio;q.m.melodyStep=63;q.m.nextBeat=q.m.context.currentTime+.025;const measurement=await q.measure(1500);return {...measurement,melodyStep:q.m.melodyStep};});
    result.wrap=wrap;assert.ok(wrap.melodyStep>64,`${mode} scheduler crosses phrase boundary`);assert.ok(wrap.rms>.012);assert.ok(wrap.longestSilenceSeconds<.4);
  }
  assert.ok(report.modes[0].voiceFamilies.triangle>0&&report.modes[0].voiceFamilies.sine>0&&!report.modes[0].voiceFamilies['noise/buffer']);
  assert.ok(report.modes.slice(1).every(mode=>mode.voiceFamilies.sawtooth>0));
  assert.ok(report.modes[1].phoneBandEnergyRatio-report.modes[0].phoneBandEnergyRatio>.03,'Measured battle spectrum has greater phone-band energy than the orchestral menu');
  report.checks.push('All three distinct mode spectra, orchestral versus sawtooth/drum families, phone-band energy, audible RMS, no clipping, continuous 64-step wrap');
  report.pause=await page.evaluate(async()=>{const q=window.__audio;q.m.setMusicPaused(true);await new Promise(resolve=>setTimeout(resolve,240));const paused=await q.measure(400);q.m.setMusicPaused(false);return {paused,resumed:await q.measure(600)};});
  assert.ok(report.pause.paused.peak<.00001);assert.ok(report.pause.resumed.rms>.012);report.checks.push('Pause renders zero PCM; resume restores music');
  await page.evaluate(async()=>{await window.__audio.m.context.suspend();});
  assert.equal(await page.evaluate(()=>window.__audio.m.isUnlocked()),false);
  await page.locator('#unlock').click();
  report.recovery=await page.evaluate(async()=>{const q=window.__audio;await q.unlockPromise;return {unlocked:q.m.isUnlocked(),state:q.m.context.state,gestures:q.trustedGestures,measurement:await q.measure(700)};});
  assert.equal(report.recovery.state,'running');assert.equal(report.recovery.unlocked,true);assert.ok(report.recovery.gestures.every(Boolean));assert.ok(report.recovery.measurement.rms>.012);
  report.checks.push('Native context.suspend followed by another trusted click resumes audible scheduling; interruption hardware remains device-only');
  await page.evaluate(async()=>{window.__audio.m.setMusicPaused(true);await new Promise(resolve=>setTimeout(resolve,250));window.__audio.sfxRecording=window.__audio.recordStart();});
  const cueNames=['battle_start_clash','hit_melee','hit_ranged','hit_magic','hit_heavy','death_rat','death_bug','death_crab','death_machine','death_frog','death_boss','elite_spawn','boss_spawn','merge_hero'];
  for(const cue of cueNames){
    const result=await page.evaluate(async(cue)=>{const q=window.__audio;q.m.play(cue);return {cue,...await q.measure(cue==='battle_start_clash'||cue==='death_boss'?1100:850)};},cue);
    report.cues.push(result);
    console.log(`${cue}: RMS ${result.rms.toFixed(4)}, peak ${result.peak.toFixed(4)}`);
  }
  await media(await page.evaluate(()=>window.__audio.recordStop(window.__audio.sfxRecording)),'sfx');
  report.cueIssues=report.cues.flatMap(result=>[...(result.peak<=.04?[`${result.cue}: inaudible peak`]:[]),...(result.rms<=.006?[`${result.cue}: low RMS`]:[]),...(result.clippedSamples>0||result.peak>=.9999?[`${result.cue}: over full scale (peak ${result.peak}, ${result.clippedSamples} samples)`]:[])]);
  report.maximumCues=[];
  await page.evaluate(()=>window.__audio.m.setSettings({musicVolume:1,soundVolume:1,showDamageNumbers:true}));
  for(const cue of cueNames){
    const result=await page.evaluate(async(cue)=>{const q=window.__audio;q.m.play(cue);return {cue,...await q.measure(cue==='battle_start_clash'||cue==='death_boss'?1100:850)};},cue);
    report.maximumCues.push(result);console.log(`max ${cue}: RMS ${result.rms.toFixed(4)}, peak ${result.peak.toFixed(4)}`);
  }
  report.busy=[];
  for(const slider of [.75,1]){
    const result=await page.evaluate(async(slider)=>{const q=window.__audio;q.m.setSettings({musicVolume:slider===1?1:.5,soundVolume:slider,showDamageNumbers:true});q.m.setMode('battle');q.m.setMusicPaused(false);
      const recording=q.recordStart();let index=0;const burst=()=>{q.m.play(['hit_magic','hit_heavy','hit_melee','hit_ranged'][index%4]);q.m.play(['death_boss','death_machine','death_rat','death_bug'][index++%4],true);q.m.play('merge_hero');};
      burst();const timer=setInterval(burst,180),measurement=await q.measure(2800);clearInterval(timer);return {slider,...measurement,recording:await q.recordStop(recording)};
    },slider);
    await media(result.recording,slider===1?'busy-maximum':'busy-default');delete result.recording;report.busy.push(result);
    console.log(`busy ${slider}: RMS ${result.rms.toFixed(4)}, peak ${result.peak.toFixed(4)}, overfull ${result.clippedSamples}`);
    await page.evaluate(async()=>{window.__audio.m.setMusicPaused(true);await new Promise(resolve=>setTimeout(resolve,1200));});
  }
  report.checks.push('Every typed impact, family death, clash and alert has independently rendered audible unclipped PCM with music paused');
  report.rapid=await page.evaluate(async()=>{const q=window.__audio;q.m.setMusicPaused(false);for(let i=0;i<50;i++){q.m.setMode(['menu','boss','battle'][i%3]);await new Promise(resolve=>setTimeout(resolve,12));}await new Promise(resolve=>setTimeout(resolve,1400));return {liveVoices:q.m.voices.size,modeBuses:q.m.modeBuses.size,connectedManagerNodes:[...q.owned].filter(node=>q.edges.get(node)?.size).length};});
  assert.ok(report.rapid.liveVoices<=20);assert.equal(report.rapid.modeBuses,3);assert.ok(report.rapid.connectedManagerNodes<70);
  report.disposal=await page.evaluate(async()=>{const q=window.__audio,c=q.m.context;q.m.dispose();await new Promise(resolve=>setTimeout(resolve,100));const stillConnected=[...q.owned].filter(node=>q.edges.get(node)?.size);q.tap.disconnect();q.silent.disconnect();q.analyser.disconnect();q.stream.stream.getTracks().forEach(track=>track.stop());return {liveVoices:q.m.voices.size,connectedManagerNodes:stillConnected.length,remainingNodeTypes:stillConnected.map(node=>node.constructor.name),unlocked:q.m.isUnlocked(),contextState:c.state};});
  assert.equal(report.disposal.liveVoices,0);assert.equal(report.disposal.connectedManagerNodes,0);assert.equal(report.disposal.unlocked,false);
  report.checks.push('Rapid mode switches stay bounded; disposal disconnects every tracked manager-created node and voice');
  assert.equal(report.disposal.contextState,'closed');
  assert.deepEqual(report.cueIssues,[],'Every default individual cue remains audible and below full scale');
  for(const result of [...report.maximumCues,...report.busy]){assert.equal(result.clippedSamples,0,`${result.cue??'busy '+result.slider} no full-scale samples`);assert.ok(result.peak<.9999);}
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){failure=error;report.passed=false;report.failure=error.stack??String(error);}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'p9-audio-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,modes:report.modes.length,cues:report.cues.length,media:report.media.map(item=>item.file),report:'verification/p9-audio-report.json',failure:report.failure},null,2));
if(failure)throw failure;
