import type {BattleState,GameSettings} from '../core/types';
import {musicStep,tempos,type MusicMode,type Note} from './MusicTracks';
export type {MusicMode} from './MusicTracks';
type CanonicalCue='ui_click'|'summon'|'shovel'|'treasure'|'merge_upgrade'|'merge_hero'|'hit_melee'|'hit_ranged'|'hit_magic'|'hit_heavy'|'battle_start_clash'|'elite_spawn'|'boss_spawn'|'death_rat'|'death_bug'|'death_crab'|'death_machine'|'death_frog'|'death_boss'|'orange_lost'|'orange_gain'|'sprinkler'|'goose'|'lottery_tick'|'lottery_win'|'victory'|'defeat';
export type SoundCue=CanonicalCue|'dig'|'upgrade'|'legendary'|'hero_merge'|'orange'|'hit_soft';
const aliases:Partial<Record<SoundCue,CanonicalCue>>={dig:'shovel',upgrade:'merge_upgrade',legendary:'merge_hero',hero_merge:'merge_hero',orange:'orange_lost',hit_soft:'hit_melee'};
const defaults:GameSettings={musicVolume:.5,soundVolume:.75,showDamageNumbers:true};
// Reserve transient/polyphony headroom before the contracted master gain chain.
// Native compression is not a brickwall limiter during simultaneous cue attacks.
const cueHeadroom=.24;
const volume=(n:unknown,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
type CueNote=Note&{bend?:{at:number;frequency:number}[]};
const arpeggio=(frequencies:number[],duration=.18,step=.09):Note[]=>frequencies.map((frequency,i)=>({frequency,delay:i*step,duration,volume:.48,type:'triangle',cutoff:4200}));
const strike=(frequency:number,slide:number,duration=.12,delay=0,level=.48):Note=>({frequency,slide,delay,duration,volume:level,type:'triangle',cutoff:4200});
const hiss=(cutoff:number,duration:number,delay=0,level=.2,cutoffSlide?:number):Note=>({frequency:cutoff,delay,duration,volume:level,noise:true,cutoff,cutoffSlide,attack:.003});
const cues:Record<CanonicalCue,CueNote[]>={
  ui_click:[strike(1080,680,.065,0,.4)],
  summon:[strike(1174.66,1567.98,.3,0,.48),strike(2350,1760,.35,.07,.38)],
  shovel:[strike(960,210,.12,0,.5),strike(1450,310,.09,.06,.38)],
  treasure:arpeggio([1046.5,1318.51,1567.98,2093],.33,.065),
  merge_upgrade:arpeggio([659.25,1046.5],.25,.075),
  merge_hero:arpeggio([523.25,659.25,783.99,1046.5],.85,0),
  hit_melee:[strike(680,210,.11,0,.58),hiss(2800,.055,0,.28)],
  hit_ranged:[strike(980,320,.09,0,.56),strike(1960,720,.055,.015,.25)],
  hit_magic:[strike(1320,990,.16,0,.5),strike(1760,1320,.18,.012,.38),hiss(3400,.045,0,.17)],
  hit_heavy:[strike(170,48,.25,0,.66),strike(1560,720,.2,0,.42),hiss(1800,.08,0,.28)],
  battle_start_clash:[hiss(1800,.18,0,.32,5200),{...strike(1950,4200,.18,0,.44),type:'sawtooth'},strike(2920,6100,.18,0,.3),
    ...[1318,1975,2637,3520].map((frequency,i)=>({...strike(frequency,frequency,.65,.19,i===0?.52:.27),attack:.002})),strike(140,58,.38,.19,.72)],
  elite_spawn:[strike(1175,1175,.12,0,.56),strike(1568,1568,.19,.16,.54)],
  boss_spawn:[{...strike(196,147,.65,0,.56),type:'sawtooth',cutoff:2600,attack:.025},strike(392,294,.6,0,.38),strike(784,588,.5,.07,.38),strike(120,44,.23,.12,.65),strike(130,45,.2,.26,.5),strike(145,48,.25,.4,.55)],
  death_rat:[{...strike(980,420,.3,0,.5),bend:[{at:.32,frequency:1480}]},strike(740,310,.1,.3,.4)],
  death_bug:[{...strike(620,180,.22,.045,.48),type:'sawtooth',cutoff:2400},strike(1900,480,.065,0,.43),hiss(2400,.055,0,.24)],
  death_crab:[strike(540,380,.14,0,.54),strike(810,570,.14,0,.46),strike(220,145,.13,.17,.4)],
  death_machine:[{...strike(880,110,.54,0,.5),type:'sawtooth',cutoff:3200},hiss(3600,.07,.04,.27),strike(2480,680,.12,.2,.24)],
  death_frog:[{...strike(340,130,.34,0,.56),bend:[{at:.4,frequency:210}],type:'sawtooth',cutoff:1400},strike(1020,390,.25,0,.28),strike(840,210,.1,.34,.4)],
  death_boss:[{...strike(620,130,.65,0,.58),type:'sawtooth',cutoff:2400},...arpeggio([880,1230,1760],.68,0).map(n=>({...n,delay:.2,volume:.4})),strike(130,45,.45,.2,.68)],
  goose:[strike(1040,460,.18,0,.44),strike(1240,520,.22,.2,.46)],
  orange_lost:[strike(840,160,.26,0,.5),strike(750,1550,.15,.16,.38)],
  orange_gain:arpeggio([659.25,1046.5],.24,.09),
  sprinkler:Array.from({length:7},(_,i)=>({...strike(800+i*170,360+i*50,.15,i*.065,.26),cutoff:3000})),
  lottery_tick:[strike(1567.98,1046.5,.055,0,.4)],
  lottery_win:arpeggio([523.25,659.25,783.99,1046.5,1318.51],.35,.075),
  victory:[...arpeggio([523.25,659.25,783.99,1046.5],.4,.12),...arpeggio([523.25,659.25,783.99],.75,0).map(n=>({...n,delay:.5,volume:.3}))],
  defeat:arpeggio([392,349.23,293.66,261.63],.32,.16),
};
// Impacts share a 45ms limit; minion deaths are limited per family, bosses bypass it.
const intervals:Partial<Record<CanonicalCue,number>>={hit_melee:.045,death_rat:.055,death_bug:.055,death_crab:.055,death_machine:.055,death_frog:.055,death_boss:.055,goose:.14,orange_lost:.08,orange_gain:.08,sprinkler:.2,boss_spawn:.35,elite_spawn:.1,treasure:.08,lottery_tick:.035};

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
  private compressor:DynamicsCompressorNode|null=null;
  private makeup:GainNode|null=null;
  private readonly primes=new Set<AudioBufferSourceNode>();
  private musicPaused=false;
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
    // Some iOS hosts expose a read-only session or a throwing getter.
    try{const session=(globalThis.navigator as (Navigator & {audioSession?:{type?:string}})|undefined)?.audioSession;if(session)session.type='playback';}catch{/* optional platform API */}
    // A pointerdown resume may stay pending under WebKit policy. Let the next
    // trusted click retry while suspended; an already running context shares work.
    if(this.unlocking&&this.context?.state==='running')return this.unlocking;
    if(this.unlocked&&this.context?.state==='running')return Promise.resolve();
    const attempt=this.open().finally(()=>{if(this.unlocking===attempt)this.unlocking=null;});
    this.unlocking=attempt;return attempt;
  }
  private async open():Promise<void> {
    try {
      if(!this.context){
        const Host=globalThis.AudioContext||(globalThis as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(!Host)return;
        this.context=new Host();
      }
      const context=this.context;
      // Resume and the silent hardware prime happen in the gesture stack, before await.
      const resuming=context.state==='running'?Promise.resolve():context.resume();
      this.prime(context);
      await resuming;
      if(this.disposed||context.state!=='running')return;
      if(this.unlocked){
        this.applyVolumes();
        if(this.playingMode!==this.mode||(this.buffers.get(`bgm_${this.mode}`)??null)!==this.playingBuffer)this.startMode();else this.scheduleMusic();
        return;
      }
      this.music=context.createGain();this.effects=context.createGain();
      let target:AudioNode=context.destination;
      if(typeof context.createDynamicsCompressor==='function'){
        const compressor=context.createDynamicsCompressor(),makeup=context.createGain();
        compressor.threshold.setValueAtTime(-10,context.currentTime);compressor.knee.setValueAtTime(12,context.currentTime);
        compressor.ratio.setValueAtTime(4,context.currentTime);compressor.attack.setValueAtTime(.003,context.currentTime);compressor.release.setValueAtTime(.16,context.currentTime);
        makeup.gain.setValueAtTime(1.35,context.currentTime);compressor.connect(makeup);makeup.connect(context.destination);
        this.compressor=compressor;this.makeup=makeup;target=compressor;
      }
      this.music.connect(target);this.effects.connect(target);
      this.unlocked=true;this.applyVolumes();this.startMode();
      this.ensureScheduler();
      if(!this.assetsStarted){this.assetsStarted=true;void this.loadAssets(context);}
    }catch{ /* Browser policy, missing hardware and failed resume are silent fallbacks. */ }
  }
  isUnlocked():boolean {return this.unlocked&&!this.disposed&&this.context?.state==='running';}
  private prime(context:AudioContext):void {
    if(typeof context.createBuffer!=='function'||typeof context.createBufferSource!=='function')return;
    let source:AudioBufferSourceNode|undefined;
    try{
      // Previous primes have ended by the next trusted gesture.
      for(const old of this.primes){old.onended=null;old.disconnect();}this.primes.clear();
      source=context.createBufferSource();source.buffer=context.createBuffer(1,1,context.sampleRate||44100);source.connect(context.destination);
      const silent=source;source.onended=()=>{silent.disconnect();this.primes.delete(silent);};this.primes.add(source);source.start(0);source.stop(context.currentTime+1/(context.sampleRate||44100));
    }catch{if(source){this.primes.delete(source);try{source.disconnect();}catch{/* closing host */}}}
  }
  private ensureScheduler():void {if(!this.musicPaused&&this.unlocked&&!this.disposed&&this.timer===null)this.timer=setInterval(()=>this.scheduleMusic(),100);}
  setMusicPaused(paused:boolean):void {
    if(this.disposed||this.musicPaused===paused)return;this.musicPaused=paused;
    if(paused){
      if(this.timer!==null){clearInterval(this.timer);this.timer=null;}
      for(const voice of this.voices)if(voice.music){try{voice.source.stop();}catch{/* ended */}this.release(voice);}
      this.playingMode=null;this.playingBuffer=null;this.applyVolumes();
    }else{this.applyVolumes();this.startMode();this.ensureScheduler();}
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
      const gain=this.music.gain,value=this.musicPaused?0:this.settings.musicVolume*.65*((this.ducked||hidden)? .24 : 1);
      gain.cancelScheduledValues(c.currentTime);
      if(soft&&value>0)gain.setTargetAtTime(value,c.currentTime,.16);else gain.setValueAtTime(value,c.currentTime);
      this.effects.gain.setValueAtTime(this.settings.soundVolume*1.15,c.currentTime);
    }catch{ /* A closing host may reject parameter writes. */ }
  }
  private startMode():void {
    const c=this.context;if(!c||this.disposed||this.musicPaused||!this.music||c.state!=='running')return;
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
    const c=this.context;if(!this.unlocked||this.disposed||this.musicPaused||!c||c.state!=='running'||!this.modeBus)return;
    this.reap(c.currentTime);
    if(this.buffers.has(`bgm_${this.mode}`)&&[...this.voices].some(v=>v.music&&v.loop&&v.end===Infinity))return;
    // Skip missed beats after suspension; never allocate a catch-up burst.
    if(this.nextBeat<c.currentTime)this.nextBeat=c.currentTime+.015;
    let scheduled=0;
    while(this.nextBeat<c.currentTime+.18&&scheduled++<3){
      for(const note of musicStep(this.mode,this.melodyStep++))this.tone(note,this.modeBus,this.nextBeat+note.delay,true);
      this.nextBeat+=60/tempos[this.mode];
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
  private tone(note:CueNote,bus:GainNode,at:number,music=false):void {
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
        for(const bend of note.bend??[])oscillator.frequency.exponentialRampToValueAtTime(bend.frequency,at+note.duration*bend.at);
        if(note.slide)oscillator.frequency.exponentialRampToValueAtTime(note.slide,at+note.duration*.9);
      }
      envelope=c.createGain();
      envelope.gain.setValueAtTime(.0001,at);envelope.gain.linearRampToValueAtTime(note.volume*(music?1:cueHeadroom),at+(note.attack??.008));envelope.gain.exponentialRampToValueAtTime(.0001,at+note.duration);
      if(note.cutoff&&typeof c.createBiquadFilter==='function'){
        filter=c.createBiquadFilter();filter.type=note.noise?'highpass':'lowpass';filter.frequency.setValueAtTime(note.cutoff,at);filter.Q.setValueAtTime(.5,at);
        if(note.cutoffSlide)filter.frequency.exponentialRampToValueAtTime(note.cutoffSlide,at+note.duration*.9);
        source.connect(filter);filter.connect(envelope);
      }else source.connect(envelope);
      envelope.connect(bus);this.register(source,envelope,at,note.duration,music,filter);
    }catch{
      try{source?.stop();}catch{/* not started */}
      for(const node of [source,envelope,filter])try{node?.disconnect();}catch{/* already closed */}
    }
  }
  private bufferVoice(buffer:AudioBuffer,bus:GainNode,at:number,music:boolean,loop=false,overlap=1):boolean {
    const c=this.context;if(!c||this.disposed||typeof c.createBufferSource!=='function')return false;
    this.reap(c.currentTime);if(this.voices.size>=96)return false;
    let source:AudioBufferSourceNode|undefined,gain:GainNode|undefined;
    try{
      source=c.createBufferSource();source.buffer=buffer;source.loop=loop;gain=c.createGain();gain.gain.setValueAtTime(music?1:cueHeadroom/overlap,at);
      source.connect(gain);gain.connect(bus);this.register(source,gain,at,buffer.duration,music,undefined,loop);return true;
    }catch{
      try{source?.stop();}catch{/* not started */}
      try{source?.disconnect();gain?.disconnect();}catch{/* closing */}return false;
    }
  }
  play(cue:SoundCue,bypassThrottle=false):void {
    const c=this.context;if(!this.unlocked||this.disposed||!c||c.state!=='running'||!this.effects||this.settings.soundVolume===0)return;
    const canonical=aliases[cue]??cue as CanonicalCue;if(!Object.hasOwn(cues,canonical))return;
    const throttleKey=canonical.startsWith('hit_')?'hit_melee':canonical;
    const last=this.lastPlayed.get(throttleKey),interval=intervals[throttleKey]??0;
    if(!bypassThrottle&&last!==undefined&&c.currentTime-last+1e-9<interval)return;
    if(!bypassThrottle)this.lastPlayed.set(throttleKey,c.currentTime);
    this.reap(c.currentTime);
    // Share attack headroom among overlapping effects, including sustained hero
    // chords. Music retains its independent bus and its contracted gain.
    const overlap=1+[...this.voices].filter(voice=>!voice.music).length/4;
    const buffer=this.buffers.get(cue)??this.buffers.get(canonical);
    if(buffer&&this.bufferVoice(buffer,this.effects,c.currentTime+.005,false,false,overlap))return;
    for(const note of cues[canonical])this.tone({...note,volume:note.volume/overlap},this.effects,c.currentTime+.005+note.delay);
  }
  consumeBattle(state:BattleState):void {
    if(this.disposed)return;
    let ids=this.seen.get(state.id);if(!ids){ids=new Set();this.seen.set(state.id,ids);if(this.seen.size>8)this.seen.delete(this.seen.keys().next().value!);}
    for(const event of state.events){
      if(ids.has(event.id))continue;ids.add(event.id);
      if(event.type==='death'){
        const kind=event.enemyKind;
        const family:CanonicalCue=kind==='rat'||kind==='charmed_rat'?'death_rat':kind==='roach'||kind==='killer_bee'?'death_bug':kind==='crab'?'death_crab':kind==='mega_roomba'?'death_machine':kind==='sad_rain_frog'?'death_frog':event.boss?'death_boss':'death_rat';
        this.play(family,event.boss===true);
      }
      else if(event.effect==='boss_spawn')this.play('boss_spawn');
      else if(event.effect==='elite_spawn')this.play('elite_spawn');
      else if(event.effect==='treasure')this.play('treasure');
      else if(event.type==='damage')this.play(event.hitCue??'hit_soft');
      else if(event.type==='dash')this.play('goose');
      else if(event.type==='orange'){
        if((event.value??0)<0)this.play('orange_lost');else if((event.value??0)>0)this.play('orange_gain');
      }
      else if(event.type==='sprinkler')this.play('sprinkler');
      else if(event.type==='purge'&&event.effect!=='legendary'&&event.effect!=='sprinkler'&&event.effect!=='clipped')this.play('merge_upgrade');
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
    for(const source of this.primes){source.onended=null;try{source.stop();source.disconnect();}catch{/* ended */}}this.primes.clear();
    this.voices.clear();this.seen.clear();this.buffers.clear();this.lastPlayed.clear();this.noise=null;
    for(const bus of [this.music,this.effects,this.compressor,this.makeup,...this.modeBuses.values()])try{bus?.disconnect();}catch{/* host closing */}
    this.modeBuses.clear();this.modeBus=null;this.playingBuffer=null;this.playingMode=null;
    if(this.context){try{void this.context.close().catch(()=>{});}catch{/* unavailable host */}}
    this.context=null;this.music=null;this.effects=null;this.compressor=null;this.makeup=null;
  }
}
