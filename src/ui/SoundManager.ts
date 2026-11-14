import type {BattleState,GameSettings} from '../core/types';
import {musicStep,tempos,type MusicMode,type Note} from './MusicTracks';
export type {MusicMode} from './MusicTracks';
type CanonicalCue='ui_click'|'summon'|'shovel'|'treasure'|'merge_upgrade'|'merge_hero'|'hit_soft'|'boss_spawn'|'orange_lost'|'orange_gain'|'sprinkler'|'goose'|'lottery_tick'|'lottery_win'|'victory'|'defeat';
export type SoundCue=CanonicalCue|'dig'|'upgrade'|'legendary'|'orange';
const aliases:Partial<Record<SoundCue,CanonicalCue>>={dig:'shovel',upgrade:'merge_upgrade',legendary:'merge_hero',orange:'orange_lost'};
const defaults:GameSettings={musicVolume:.5,soundVolume:.75,showDamageNumbers:true};
const volume=(n:unknown,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
const arpeggio=(frequencies:number[],duration=.18,step=.09):Note[]=>frequencies.map((frequency,i)=>({frequency,delay:i*step,duration,volume:.24,type:'sine'}));
const cues:Record<CanonicalCue,Note[]>={
  ui_click:[{frequency:720,slide:400,delay:0,duration:.06,volume:.15,type:'triangle'}],
  summon:[{frequency:1174.66,delay:0,duration:.3,volume:.2},{frequency:1760,delay:.07,duration:.35,volume:.13}],
  shovel:[{frequency:160,slide:55,delay:0,duration:.12,volume:.32,type:'triangle'},{frequency:310,slide:95,delay:.06,duration:.09,volume:.16,type:'triangle'}],
  treasure:arpeggio([1046.5,1318.51,1567.98,2093],.33,.065),
  merge_upgrade:arpeggio([659.25,1046.5],.25,.075),
  merge_hero:arpeggio([523.25,659.25,783.99,1046.5],.85,0),
  hit_soft:[{frequency:460,slide:190,delay:0,duration:.065,volume:.11}],
  boss_spawn:[{frequency:130.81,slide:98,delay:0,duration:.65,volume:.24,type:'triangle',cutoff:900,attack:.05},{frequency:75,slide:40,delay:.12,duration:.23,volume:.22},{frequency:110,slide:55,delay:.38,duration:.18,volume:.15}],
  goose:[{frequency:520,slide:230,delay:0,duration:.18,volume:.2,type:'triangle'},{frequency:620,slide:260,delay:.2,duration:.22,volume:.22,type:'triangle'}],
  orange_lost:[{frequency:420,slide:80,delay:0,duration:.26,volume:.24},{frequency:150,slide:310,delay:.16,duration:.15,volume:.18}],
  orange_gain:arpeggio([659.25,1046.5],.24,.09),
  sprinkler:Array.from({length:7},(_,i)=>({frequency:400+i*170,slide:180+i*50,delay:i*.065,duration:.15,volume:.09,type:'triangle',cutoff:2000})),
  lottery_tick:[{frequency:1046.5,delay:0,duration:.055,volume:.15}],
  lottery_win:arpeggio([523.25,659.25,783.99,1046.5,1318.51],.35,.075),
  victory:[...arpeggio([523.25,659.25,783.99,1046.5],.4,.12),...arpeggio([523.25,659.25,783.99],.75,0).map(n=>({...n,delay:.5,volume:.14}))],
  defeat:arpeggio([392,349.23,293.66,261.63],.32,.16),
};
// Only repeated simulation/lottery cues are limited. Successful commands stay responsive.
const intervals:Partial<Record<CanonicalCue,number>>={hit_soft:.095,goose:.14,orange_lost:.08,orange_gain:.08,sprinkler:.2,boss_spawn:.35,treasure:.08,lottery_tick:.035};
type Voice={source:AudioScheduledSourceNode;gain:GainNode;filter?:BiquadFilterNode;end:number;music:boolean;loop?:boolean};
type AssetKey=SoundCue|`bgm_${MusicMode}`;
const assetKeys=new Set<string>([...Object.keys(cues),...Object.keys(aliases),'bgm_menu','bgm_battle','bgm_boss']);
// No absolute URLs, traversal, encoded separators, query strings or protocol-relative files.
const safeFile=(value:unknown):value is string=>typeof value==='string'&&/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:mp3|ogg|wav|m4a|aac)$/i.test(value);

/** Gesture-unlocked audio graph: two master buses, one scheduler and optional decoded overrides. */
export class SoundManager {
  private settings:GameSettings;
  private context:AudioContext|null=null;
  private music:GainNode|null=null;
  private effects:GainNode|null=null;
  private unlocking:Promise<void>|null=null;
  private unlocked=false;
  private disposed=false;
  private ducked=false;
  private mode:MusicMode='menu';
  private playingMode:MusicMode|null=null;
  private playingBuffer:AudioBuffer|null=null;
  private modeBus:GainNode|null=null;
  private readonly modeBuses=new Map<MusicMode,GainNode>();
  private timer:ReturnType<typeof setInterval>|null=null;
  private melodyStep=0;
  private nextBeat=0;
  private noise:AudioBuffer|null=null;
  private readonly voices=new Set<Voice>();
  private readonly seen=new Map<string,Set<number>>();
  private readonly lastPlayed=new Map<CanonicalCue,number>();
  private readonly buffers=new Map<AssetKey,AudioBuffer>();
  private assetsStarted=false;
  private readonly pending=typeof AbortController!=='undefined'?new AbortController():null;
  private readonly visibility=()=>this.applyVolumes(true);
  constructor(settings:Partial<GameSettings>={}) {
    this.settings={musicVolume:volume(settings.musicVolume,.5),soundVolume:volume(settings.soundVolume,.75),showDamageNumbers:settings.showDamageNumbers??true};
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.visibility);
  }
  unlock():Promise<void> {
    if(this.disposed)return Promise.resolve();
    if(this.unlocking)return this.unlocking;
    if(this.unlocked&&this.context?.state==='running')return Promise.resolve();
    this.unlocking=this.open().finally(()=>{this.unlocking=null;});return this.unlocking;
  }
  private async open():Promise<void> {
    try {
      if(!this.context){
        const Host=globalThis.AudioContext||(globalThis as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(!Host)return;
        this.context=new Host();
      }
      const context=this.context;
      await context.resume();
      if(this.disposed||context.state!=='running')return;
      if(this.unlocked){
        this.applyVolumes();
        if(this.playingMode!==this.mode||(this.buffers.get(`bgm_${this.mode}`)??null)!==this.playingBuffer)this.startMode();else this.scheduleMusic();
        return;
      }
      this.music=context.createGain();this.effects=context.createGain();
      this.music.connect(context.destination);this.effects.connect(context.destination);
      this.unlocked=true;this.applyVolumes();this.startMode();
      if(this.timer===null)this.timer=setInterval(()=>this.scheduleMusic(),100);
      if(!this.assetsStarted){this.assetsStarted=true;void this.loadAssets(context);}
    }catch{ /* Browser policy, missing hardware and failed resume are silent fallbacks. */ }
  }
  setSettings(settings:GameSettings):void {
    const enabling=this.settings.soundVolume===0&&volume(settings.soundVolume,defaults.soundVolume)>0;
    this.settings={musicVolume:volume(settings.musicVolume,defaults.musicVolume),soundVolume:volume(settings.soundVolume,defaults.soundVolume),showDamageNumbers:settings.showDamageNumbers};
    if(enabling)this.lastPlayed.clear();this.applyVolumes();
  }
  setDucked(ducked:boolean):void {if(this.ducked===ducked)return;this.ducked=ducked;this.applyVolumes(true);}
  setMode(mode:MusicMode):void {
    if(this.disposed||this.mode===mode||!['menu','battle','boss'].includes(mode))return;
    this.mode=mode;if(this.unlocked)this.startMode();
  }
  private applyVolumes(soft=false):void {
    const c=this.context;if(!c||!this.music||!this.effects)return;
    const hidden=typeof document!=='undefined'&&document.hidden;
    try{
      const gain=this.music.gain,value=this.settings.musicVolume*.12*((this.ducked||hidden)? .15 : 1);
      gain.cancelScheduledValues(c.currentTime);
      if(soft&&value>0)gain.setTargetAtTime(value,c.currentTime,.16);else gain.setValueAtTime(value,c.currentTime);
      this.effects.gain.setValueAtTime(this.settings.soundVolume*.5,c.currentTime);
    }catch{ /* A closing host may reject parameter writes. */ }
  }
  private startMode():void {
    const c=this.context;if(!c||this.disposed||!this.music||c.state!=='running')return;
    const now=c.currentTime;
    this.playingMode=this.mode;this.playingBuffer=null;
    // Reuse at most three arrangement buses, even under rapid UI mode changes.
    for(const bus of this.modeBuses.values()){
      bus.gain.cancelScheduledValues(now);bus.gain.setValueAtTime(bus.gain.value,now);bus.gain.linearRampToValueAtTime(0,now+.22);
    }
    for(const voice of this.voices)if(voice.music){
      // Per-voice fades let a mode's cached bus be reused safely during rapid switches.
      voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(Math.max(.0001,voice.gain.gain.value),now);voice.gain.gain.linearRampToValueAtTime(0,now+.2);
      try{voice.source.stop(now+.22);}catch{/* already ended */}voice.end=Math.min(voice.end,now+.23);
    }
    let bus=this.modeBuses.get(this.mode);
    if(!bus){bus=c.createGain();bus.connect(this.music);this.modeBuses.set(this.mode,bus);}
    bus.gain.cancelScheduledValues(now);bus.gain.setValueAtTime(0,now);bus.gain.linearRampToValueAtTime(1,now+.22);this.modeBus=bus;
    this.melodyStep=0;this.nextBeat=now+.025;
    const buffer=this.buffers.get(`bgm_${this.mode}`);
    if(buffer&&this.bufferVoice(buffer,bus,now+.015,true,true)){this.playingBuffer=buffer;return;}
    this.scheduleMusic();
  }
  private scheduleMusic():void {
    const c=this.context;if(!this.unlocked||this.disposed||!c||c.state!=='running'||!this.modeBus)return;
    this.reap(c.currentTime);
    if(this.buffers.has(`bgm_${this.mode}`)&&[...this.voices].some(v=>v.music&&v.loop&&v.end===Infinity))return;
    // Skip missed beats after suspension; never allocate a catch-up burst.
    if(this.nextBeat<c.currentTime)this.nextBeat=c.currentTime+.015;
    let scheduled=0;
    while(this.nextBeat<c.currentTime+.18&&scheduled++<3){
      for(const note of musicStep(this.mode,this.melodyStep++))this.tone(note,this.modeBus,this.nextBeat,true);
      this.nextBeat+=30/tempos[this.mode];
    }
  }
  private reap(now:number):void {for(const voice of this.voices)if(voice.end<now)this.release(voice);}
  private release(voice:Voice):void {
    voice.source.onended=null;
    for(const node of [voice.source,voice.filter,voice.gain])try{node?.disconnect();}catch{/* host closing */}
    this.voices.delete(voice);
  }
  private register(source:AudioScheduledSourceNode,gain:GainNode,at:number,duration:number,music:boolean,filter?:BiquadFilterNode,loop=false):void {
    const voice:Voice={source,gain,filter,end:loop?Infinity:at+duration+.02,music,loop};
    // A restricted host may reject start(); failed sources must never enter the live set.
    source.start(at);if(!loop)source.stop(at+duration+.015);
    this.voices.add(voice);source.onended=()=>this.release(voice);
  }
  private tone(note:Note,bus:GainNode,at:number,music=false):void {
    const c=this.context;if(!c||this.disposed)return;
    this.reap(c.currentTime);if(this.voices.size>=96)return;
    let source:AudioScheduledSourceNode|undefined,envelope:GainNode|undefined,filter:BiquadFilterNode|undefined;
    try{
      if(note.noise&&typeof c.createBuffer==='function'&&typeof c.createBufferSource==='function'){
        if(!this.noise){
          this.noise=c.createBuffer(1,Math.max(1,Math.floor(c.sampleRate*.2)),c.sampleRate);
          const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        }
        const noise=c.createBufferSource();noise.buffer=this.noise;source=noise;
      }else{
        const oscillator=c.createOscillator();source=oscillator;oscillator.type=note.type|| (note.noise?'triangle':'sine');oscillator.frequency.setValueAtTime(note.frequency,at);
        if(note.slide)oscillator.frequency.exponentialRampToValueAtTime(note.slide,at+note.duration*.9);
      }
      envelope=c.createGain();
      envelope.gain.setValueAtTime(.0001,at);envelope.gain.linearRampToValueAtTime(note.volume,at+(note.attack??.008));envelope.gain.exponentialRampToValueAtTime(.0001,at+note.duration);
      if(note.cutoff&&typeof c.createBiquadFilter==='function'){
        filter=c.createBiquadFilter();filter.type=note.noise?'highpass':'lowpass';filter.frequency.setValueAtTime(note.cutoff,at);filter.Q.setValueAtTime(.5,at);
        source.connect(filter);filter.connect(envelope);
      }else source.connect(envelope);
      envelope.connect(bus);this.register(source,envelope,at,note.duration,music,filter);
    }catch{
      try{source?.stop();}catch{/* not started */}
      for(const node of [source,envelope,filter])try{node?.disconnect();}catch{/* already closed */}
    }
  }
  private bufferVoice(buffer:AudioBuffer,bus:GainNode,at:number,music:boolean,loop=false):boolean {
    const c=this.context;if(!c||this.disposed||typeof c.createBufferSource!=='function')return false;
    this.reap(c.currentTime);if(this.voices.size>=96)return false;
    let source:AudioBufferSourceNode|undefined,gain:GainNode|undefined;
    try{
      source=c.createBufferSource();source.buffer=buffer;source.loop=loop;gain=c.createGain();gain.gain.setValueAtTime(1,at);
      source.connect(gain);gain.connect(bus);this.register(source,gain,at,buffer.duration,music,undefined,loop);return true;
    }catch{
      try{source?.stop();}catch{/* not started */}
      try{source?.disconnect();gain?.disconnect();}catch{/* closing */}return false;
    }
  }
  play(cue:SoundCue):void {
    const c=this.context;if(!this.unlocked||this.disposed||!c||c.state!=='running'||!this.effects||this.settings.soundVolume===0)return;
    const canonical=aliases[cue]??cue as CanonicalCue;if(!Object.hasOwn(cues,canonical))return;
    const last=this.lastPlayed.get(canonical),interval=intervals[canonical]??0;
    if(last!==undefined&&c.currentTime-last+1e-9<interval)return;
    this.lastPlayed.set(canonical,c.currentTime);
    const buffer=this.buffers.get(cue)??this.buffers.get(canonical);
    if(buffer&&this.bufferVoice(buffer,this.effects,c.currentTime+.005,false))return;
    for(const note of cues[canonical])this.tone(note,this.effects,c.currentTime+.005+note.delay);
  }
  consumeBattle(state:BattleState):void {
    if(this.disposed)return;
    let ids=this.seen.get(state.id);if(!ids){ids=new Set();this.seen.set(state.id,ids);if(this.seen.size>8)this.seen.delete(this.seen.keys().next().value!);}
    for(const event of state.events){
      if(ids.has(event.id))continue;ids.add(event.id);
      if(event.effect==='boss_spawn')this.play('boss_spawn');
      else if(event.effect==='treasure')this.play('treasure');
      else if(event.type==='damage')this.play('hit_soft');
      else if(event.type==='dash')this.play('goose');
      else if(event.type==='orange'){
        if((event.value??0)<0)this.play('orange_lost');else if((event.value??0)>0)this.play('orange_gain');
      }
      else if(event.type==='sprinkler')this.play('sprinkler');
      else if(event.type==='purge'&&event.effect!=='legendary'&&event.effect!=='sprinkler')this.play('merge_upgrade');
    }
  }
  private async loadAssets(context:AudioContext):Promise<void> {
    if(typeof fetch!=='function')return;
    const base=`${import.meta.env.BASE_URL||'./'}audio/`,options=this.pending?{signal:this.pending.signal}:undefined;
    try{
      const response=await fetch(`${base}manifest.json`,options);if(this.disposed||!response.ok)return;
      const manifest:unknown=await response.json();if(this.disposed||!manifest||typeof manifest!=='object'||Array.isArray(manifest))return;
      if(typeof context.decodeAudioData!=='function'||typeof context.createBufferSource!=='function')return;
      await Promise.allSettled(Object.entries(manifest).filter(([key,file])=>assetKeys.has(key)&&safeFile(file)).map(async([key,file])=>{
        try{
          if(this.disposed)return;const asset=await fetch(`${base}${file}`,options);if(this.disposed||!asset.ok)return;
          const data=await asset.arrayBuffer();if(this.disposed)return;
          const buffer=await context.decodeAudioData(data);if(this.disposed||this.context!==context)return;
          this.buffers.set(key as AssetKey,buffer);
          if(key===`bgm_${this.mode}`)this.startMode();
        }catch{/* Missing files, rejected fetch, codec failure and aborted loads keep builtin sound. */}
      }));
    }catch{/* An absent/invalid manifest is optional, never a gameplay failure. */}
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.unlocked=false;this.pending?.abort();
    if(this.timer!==null){clearInterval(this.timer);this.timer=null;}
    if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.visibility);
    for(const voice of this.voices){try{voice.source.stop();}catch{/* already ended */}this.release(voice);}
    this.voices.clear();this.seen.clear();this.buffers.clear();this.lastPlayed.clear();this.noise=null;
    for(const bus of [this.music,this.effects,...this.modeBuses.values()])try{bus?.disconnect();}catch{/* host closing */}
    this.modeBuses.clear();this.modeBus=null;this.playingBuffer=null;this.playingMode=null;
    if(this.context){try{void this.context.close().catch(()=>{});}catch{/* unavailable host */}}
    this.context=null;this.music=null;this.effects=null;
  }
}
