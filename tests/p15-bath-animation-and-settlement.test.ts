import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {BattleEngine} from '../src/core/BattleEngine';
import {createProfile} from '../src/core/MetaProgression';
import {GUARDIAN_BATH_SPOTS,WATER_CLIP_GROW} from '../src/config/guardianBaths';
import {BROTHS,BROTH_IDS,CLEAR_SPRING} from '../src/config/kitchen';
import {assets} from '../src/render/AssetRegistry';
import * as registry from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {CALM_CYCLE,HAPPY_DURATION,guardianFrame,guardianPose,soupPalette} from '../src/render/GuardianBathRenderer';
import {P15_SCENE_IDS,sceneSticker} from '../src/ui/stickers';
import {resultMarkup,pauseMarkup,type ResultViewInput} from '../src/ui/SettlementView';
import {setLanguage,t} from '../src/i18n/i18n';
import {p15En,p15Zh} from '../src/i18n/p15';
import type {BattleLoadout,BattleState,MapId} from '../src/core/types';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();setLanguage('zh-CN');});
const MAPS=Object.keys(GUARDIAN_BATH_SPOTS) as MapId[];
const sprite=(id:string)=>readFileSync(`public/assets/sprites/${id}.png`);

/** Minimal PNG reader (8-bit RGB/RGBA, non-interlaced) so pixel checks need no dependencies. */
function decodePng(buffer:Buffer):{width:number;height:number;rgba:Uint8Array} {
  let offset=8,width=0,height=0,type=0;const idat:Buffer[]=[];
  while(offset<buffer.length){
    const length=buffer.readUInt32BE(offset),kind=buffer.toString('ascii',offset+4,offset+8),data=buffer.subarray(offset+8,offset+8+length);
    if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);type=data[9];expect(data[8]).toBe(8);expect(data[12]).toBe(0);}
    if(kind==='IDAT')idat.push(data);
    offset+=12+length;
  }
  const channels=type===6?4:3,stride=width*channels,raw=inflateSync(Buffer.concat(idat)),pixels=new Uint8Array(height*stride);
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)],row=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),out=pixels.subarray(y*stride,(y+1)*stride),up=y?pixels.subarray((y-1)*stride,y*stride):undefined;
    for(let i=0;i<stride;i++){
      const a=i>=channels?out[i-channels]:0,b=up?up[i]:0,c=up&&i>=channels?up[i-channels]:0;
      const paeth=()=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
      out[i]=(row[i]+(filter===1?a:filter===2?b:filter===3?(a+b)>>1:filter===4?paeth():0))&255;
    }
  }
  if(channels===4)return{width,height,rgba:pixels};
  const rgba=new Uint8Array(width*height*4);for(let i=0;i<width*height;i++){rgba.set(pixels.subarray(i*3,i*3+3),i*4);rgba[i*4+3]=255;}
  return{width,height,rgba};
}

describe('P15 synced art',()=>{
  const sizes:Record<string,[number,number]>={
    capybara_soak:[256,256],capybara_soak_2:[256,256],capybara_soak_3:[256,256],capybara_soak_4:[256,256],capybara_soak_dizzy:[256,256],capybara_soak_dizzy_2:[256,256],
    broth_topping_yuzu:[128,128],broth_topping_sakura:[128,128],ui_victory_shield_wings:[512,512],ui_defeat_shield_wings:[512,512],
    ui_weapon_fragment:[160,160],ui_rank_protect_shield:[160,160],ui_streak_flame:[160,160],ui_clock_sand:[160,160],
    ...Object.fromEntries(MAPS.map(id=>[`tub_rim_${id}`,[GUARDIAN_BATH_SPOTS[id].rim.dw,GUARDIAN_BATH_SPOTS[id].rim.dh] as [number,number]])),
  };
  it('ships 268 unique sprites with every new or repainted P15 PNG at its exact RGBA size',()=>{
    const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8')) as string[];
    expect(ids).toHaveLength(268);expect(new Set(ids).size).toBe(268);
    for(const [id,[w,h]] of Object.entries(sizes)){expect(ids).toContain(id);const png=sprite(id);expect([png.readUInt32BE(16),png.readUInt32BE(20),png[25]]).toEqual([w,h,6]);}
  });
  it('removes every cyan water ring from all six soak frames; only the bottom chest arc remains',()=>{
    for(const id of ['capybara_soak','capybara_soak_2','capybara_soak_3','capybara_soak_4','capybara_soak_dizzy','capybara_soak_dizzy_2']){
      const {width,rgba}=decodePng(sprite(id));let cyan=0,lowest=0;
      for(let y=0;y<256;y++)for(let x=0;x<218;x++){const i=(y*width+x)*4,[r,g,b,a]=rgba.subarray(i,i+4);
        if(a>200&&b>r+40&&g>r+30)cyan++;if(a>8)lowest=Math.max(lowest,y);}
      expect(cyan,id).toBe(0);expect(lowest,id).toBeLessThan(222);
    }
  });
  it.each(MAPS)('copies the %s front rim pixel-for-pixel from the map and leaves the water open',map=>{
    const rim=decodePng(sprite(`tub_rim_${map}`)),base=decodePng(sprite(`map_${map}`)),{dx,dy}=GUARDIAN_BATH_SPOTS[map].rim;
    let opaque=0;
    for(let y=0;y<rim.height;y++)for(let x=0;x<rim.width;x++){
      const i=(y*rim.width+x)*4;if(!rim.rgba[i+3])continue;opaque++;const j=((dy+y)*base.width+dx+x)*4;
      expect([rim.rgba[i],rim.rgba[i+1],rim.rgba[i+2]]).toEqual([base.rgba[j],base.rgba[j+1],base.rgba[j+2]]);
    }
    expect(opaque).toBeGreaterThan(1500);
    const spot=GUARDIAN_BATH_SPOTS[map],cx=Math.round(spot.x+spot.water.x-dx),cy=Math.round(spot.y+spot.water.y+spot.water.ry*.5-dy);
    expect(rim.rgba[(cy*rim.width+cx)*4+3]).toBe(0);
  });
  it('renders four distinct borderless, text-free settlement icon fallbacks and upgrades to PNGs',()=>{
    const svgs=P15_SCENE_IDS.map(id=>sceneSticker(id,'',64));
    for(const svg of svgs){expect(svg).toContain('<svg');expect(svg).not.toContain('<text');expect(svg).not.toContain('stroke="#fffdf6"');}
    expect(new Set(svgs.map(s=>s.replace(/data-sticker="[^"]*"|aria-label="[^"]*"/g,''))).size).toBe(4);
    vi.spyOn(registry,'spriteUrl').mockImplementation(id=>`/nested/assets/sprites/${id}.png`);
    for(const id of P15_SCENE_IDS)expect(sceneSticker(id,'',64)).toContain(`src="/nested/assets/sprites/${id}.png"`);
  });
});

describe('P15 soaking animation',()=>{
  it('plays the calm four-beat loop, a happy beat and a rapid dizzy pair',()=>{
    expect(CALM_CYCLE).toBeCloseTo(8.3,10);
    expect([0,3.1,3.3,4.5,4.7,6.9,7.1,8.2,8.4].map(s=>guardianFrame(s,false))).toEqual(['capybara_soak','capybara_soak','capybara_soak_2','capybara_soak_2','capybara_soak','capybara_soak','capybara_soak_3','capybara_soak_3','capybara_soak']);
    expect(guardianFrame(1,false,1+HAPPY_DURATION)).toBe('capybara_soak_4');expect(guardianFrame(4,false,3)).toBe('capybara_soak_2');
    expect([0,.23,.45,.67].map(s=>guardianFrame(s,true,99))).toEqual(['capybara_soak_dizzy','capybara_soak_dizzy_2','capybara_soak_dizzy','capybara_soak_dizzy_2']);
  });
  it('breathes with the specified bob, squash and tilt',()=>{
    for(const s of [0,.7,2.3]){
      const pose=guardianPose(s,false);
      expect(pose.bobY).toBeCloseTo(Math.sin(s*1.8)*2,10);expect(pose.scaleX).toBeCloseTo(1+Math.sin(s*1.8+.6)*.028,10);
      expect(pose.scaleY).toBeCloseTo(1-Math.sin(s*1.8+.6)*.025,10);expect(pose.tilt).toBeCloseTo(Math.sin(s*.9)*.025,10);expect(pose.swayX).toBe(0);
    }
    expect(Math.abs(guardianPose(.31,true).swayX)).toBeGreaterThan(0);
  });
  it('gives every broth its own layered soup palette and garnish, distinct from the clear spring',()=>{
    expect(CLEAR_SPRING).toMatchObject({bathCenter:'#B9F0EC',bathColor:'#7FD5D0',bathEdge:'#53A9A8'});
    expect(soupPalette(null)).toMatchObject({center:'#B9F0EC',main:'#7FD5D0',edge:'#53A9A8',tier:0});
    const signatures=new Set<string>();
    for(const id of BROTH_IDS){
      const b=BROTHS[id];for(const color of [b.bathCenter,b.bathEdge,b.foamColor])expect(color).toMatch(/^#[0-9A-F]{6}$/);
      expect(b.bubbles).toBeGreaterThan(0);signatures.add(`${b.bathCenter}${b.bathColor}${b.bathEdge}`);
      expect(soupPalette(id,3)).toMatchObject({center:b.bathCenter,main:b.bathColor,edge:b.bathEdge,foam:b.foamColor,topping:b.topping,level:3});
    }
    expect(signatures.size).toBe(12);expect(BROTHS.dish_spicy_hotpot.bubbles).toBeGreaterThan(BROTHS.dish_sakura_milk.bubbles);
  });
});

type Call={name:string;args:unknown[];fill?:unknown;stroke?:unknown;op?:unknown};
function surface(){
  const calls:Call[]=[],stops:string[]=[],values:Record<string,unknown>={globalAlpha:1};
  const c=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return(s:string)=>({width:s.length*8});
    if(k.includes('Gradient'))return()=>({addColorStop:(_:number,color:string)=>stops.push(color)});
    return(...args:unknown[])=>{calls.push({name:k,args,fill:v.fillStyle,stroke:v.strokeStyle,op:v.globalCompositeOperation});};},set(v,k:string,x){v[k]=x;return true;}}) as unknown as CanvasRenderingContext2D;
  return{calls,stops,renderer:new StickerRenderer({getContext:()=>c,width:0,height:0} as unknown as HTMLCanvasElement)};
}
const image=(id:string)=>({id,complete:true,naturalWidth:256,naturalHeight:256} as unknown as HTMLImageElement);
const loaded=new Map<string,HTMLImageElement>();
const fakeAssets=(id:string)=>{if(!/^(map_|tub_rim_|capybara_soak|broth_topping_|orange$)/.test(id))return undefined;if(!loaded.has(id))loaded.set(id,image(id));return loaded.get(id);};
const loadout=(id:string|null):BattleLoadout=>({ownedProps:{},equippedWeapons:{},equippedActiveProps:[],equippedPassiveProps:[],...(id?{unlockedBroths:[id],brothLevels:{[id]:3},activeBrothId:id}:{})});
const battle=(mapId:MapId,broth:string|null):BattleState=>new BattleEngine({seed:5,autoWaves:false,mapId,loadouts:{player:loadout(broth)}}).state;
const drawnId=(call:Call)=>(call.args[0] as {id?:string}|undefined)?.id;
describe('P15 five-layer bath pipeline',()=>{
  it.each(MAPS)('draws map → clipped soup → capybara → %s front rim → steam in strict order',map=>{
    vi.spyOn(assets,'get').mockImplementation(fakeAssets);
    const s=surface();s.renderer.draw(battle(map,'dish_yuzu_bath'),0);const calls=s.calls;
    const at=(test:(c:Call)=>boolean)=>calls.findIndex(test);
    const mapAt=at(c=>c.name==='drawImage'&&drawnId(c)===`map_${map}`),w=GUARDIAN_BATH_SPOTS[map].water;
    const soupAt=at(c=>c.name==='ellipse'&&c.args[0]===w.x&&c.args[1]===w.y&&c.args[2]===w.rx+WATER_CLIP_GROW);
    const clipAt=calls.findIndex((c,i)=>i>soupAt&&c.name==='clip'),fillAt=calls.findIndex((c,i)=>i>clipAt&&c.name==='fillRect');
    const toppingAt=at(c=>c.name==='drawImage'&&drawnId(c)==='broth_topping_yuzu');
    const capyAt=at(c=>c.name==='drawImage'&&String(drawnId(c)).startsWith('capybara_soak'));
    const rimAt=at(c=>c.name==='drawImage'&&drawnId(c)===`tub_rim_${map}`);
    const steamAt=calls.findIndex((c,i)=>i>rimAt&&c.name==='bezierCurveTo');
    expect(mapAt).toBeGreaterThanOrEqual(0);
    for(const [a,b] of [[mapAt,soupAt],[soupAt,clipAt],[clipAt,fillAt],[fillAt,toppingAt],[toppingAt,capyAt],[capyAt,rimAt],[rimAt,steamAt]])expect(a).toBeLessThan(b);
    const rim=GUARDIAN_BATH_SPOTS[map].rim;expect(calls[rimAt].args.slice(1)).toEqual([rim.dx,rim.dy,rim.dw,rim.dh]);
  });
  it('paints the clear spring without broth and a different soup and garnish for each of the 12 broths',()=>{
    vi.spyOn(assets,'get').mockImplementation(fakeAssets);
    const clear=surface();clear.renderer.draw(battle('sunny_backyard',null),0);
    expect(clear.stops).toEqual(expect.arrayContaining(['#B9F0EC','#7FD5D0','#53A9A8']));
    expect(clear.calls.some(c=>c.name==='drawImage'&&String(drawnId(c)).startsWith('broth_topping_'))).toBe(false);
    const looks=new Set<string>();
    for(const id of BROTH_IDS){
      const s=surface();s.renderer.draw(battle('sakura_onsen',id),0);const b=BROTHS[id];
      expect(s.stops).toEqual(expect.arrayContaining([b.bathCenter,b.bathColor,b.bathEdge]));expect(s.stops).not.toContain('#B9F0EC');
      looks.add(JSON.stringify(s.stops.slice(0,4))+s.calls.filter(c=>c.name==='fill').map(c=>String(c.fill)).join());
    }
    expect(looks.size).toBe(12);
    const spicy=surface();spicy.renderer.draw(battle('midnight_kitchen','dish_spicy_hotpot'),0);
    expect(spicy.calls.some(c=>c.name==='fill'&&c.fill==='#D9362B')).toBe(true);
    const sakura=surface();sakura.renderer.draw(battle('sakura_onsen','dish_sakura_milk'),0);
    expect(sakura.calls.some(c=>c.name==='drawImage'&&drawnId(c)==='broth_topping_sakura')).toBe(true);
  });
  it('advances the soaking frames with scene time, freezes them while paused, and smiles after a legendary merge',()=>{
    vi.spyOn(assets,'get').mockImplementation(fakeAssets);
    const state=battle('cat_tower_maze','dish_matcha_tea'),{calls,renderer}=surface();
    const frames:string[]=[];let wall=0;
    const frame=()=>{calls.length=0;renderer.draw(state,wall);return String(drawnId(calls.find(c=>c.name==='drawImage'&&String(drawnId(c)).startsWith('capybara_soak'))!));};
    for(let i=0;i<90;i++){wall+=.1;frames.push(frame());}
    expect(new Set(frames).size).toBeGreaterThanOrEqual(2);
    state.phase='paused';calls.length=0;renderer.draw(state,wall+.1);const pausedA=JSON.stringify(calls);
    for(let i=0;i<20;i++){wall+=.1;calls.length=0;renderer.draw(state,wall);}
    expect(JSON.stringify(calls)).toBe(pausedA);
    state.phase='playing';state.events.push({id:999999,type:'purge',side:'player',col:2,row:2,effect:'legendary',age:0,duration:1.4});
    wall+=.1;expect(frame()).toBe('capybara_soak_4');
    for(let i=0;i<25;i++){wall+=.1;frame();}
    expect(frame()).not.toBe('capybara_soak_4');
    state.sides.player.oranges=0;wall+=.1;expect(frame()).toMatch(/^capybara_soak_dizzy/);
  });
});

function resultInput(won=true,oranges=3):ResultViewInput {
  const engine=new BattleEngine({autoWaves:false});engine.start();engine.surrender();
  engine.state.sides.player.oranges=oranges;
  Object.assign(engine.state.result!,{winner:won?'player':'ai',reason:'waves',elapsed:125,coins:won?65:0,loot:won?['m01_swatter','m01_swatter','m10_bamboo_staff','fake_fragment']:[],
    ingredientLoot:won?['ing_yuzu','ing_honey']:['ing_sakura','ing_sakura'],mvp:{kind:'kungfu_po',level:3,damage:1234.6,kills:27}});
  return{state:engine.state,profile:{...createProfile(),stars:5},savedResult:true,resultStars:won?2:0,previousRank:0,newWeapons:[],newAvatars:[]};
}
describe('P15 wide-belly settlement',()=>{
  it.each(['zh-CN','en'] as const)('keeps two clean plaque blocks with big icon rewards and picture-only rank badges (%s)',language=>{
    setLanguage(language);
    const win=resultMarkup(resultInput()),plaque=win.match(/<div class="crest-plaque-body">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)![0];
    expect(plaque.match(/class="crest-rank-block"/g)).toHaveLength(1);expect(plaque.match(/class="crest-core-rewards"/g)).toHaveLength(1);
    expect(plaque.match(/class="crest-reward /g)).toHaveLength(4);
    for(const [id,size] of [['ui_coin_gold',62],['ui_ticket_gacha',56],['ui_weapon_fragment',56],['ui_kitchen_pot',56]] as const)expect(plaque).toMatch(new RegExp(`data-sticker="${id}"[^>]*width="${size}"|width="${size}"[^>]*data-sticker="${id}"`));
    expect(plaque).toContain('+65');expect(plaque).toContain('+4');expect(plaque).toContain('+2');
    expect(plaque).toContain('data-sticker="ui_streak_flame"');expect(plaque).toContain(`title="${t('m3.streakBonus')}"`);expect(plaque).toContain('+2★');
    expect(win).not.toContain('ui_merge_sparkle');expect(plaque).not.toMatch(/>[^<]{24,}</);
    const loss=resultMarkup(resultInput(false));
    expect(loss).toContain('data-sticker="ui_rank_protect_shield"');expect(loss).toContain(`title="${t('m3.protected')}"`);expect(loss).toContain('0★');
    expect(loss).toMatch(/class="crest-reward crest-bonus crest-ingredients"[^>]*>[^]*?data-sticker="ing_sakura"/);
    expect(loss).toContain(t('p15.again'));expect(win).toContain(t('p15.continue'));expect(win).toContain(t('p15.report'));
  });
  it('keeps every P12/P13 contract: ribbon arc, progress semantics, drawer controls and saved receipt',()=>{
    const html=resultMarkup({...resultInput(),statsOpen:true});
    expect(html).toContain('id="crest-ribbon-curve" d="M 26,74 Q 190,34 354,74"');expect(html).toContain('data-sticker="ui_victory_shield_wings"');
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="\d+"[^>]*aria-valuenow="\d+"/);
    expect(html).toMatch(/class="crest-rank-line"[\s\S]*?<\/div>\s*<div class="crest-exp-bar"/);
    for(const action of ['toggle-result-stats','close-result-stats','menu','start'])expect(html).toContain(`data-action="${action}"`);
    expect(html).toContain('aria-controls="result-stats"');expect(html).toContain(t('result.awarded'));
    expect(html).toContain('class="save-note save-check"');
  });
  it('tells the report with giant pictures, a sand clock and no emoji',()=>{
    const html=resultMarkup({...resultInput(),statsOpen:true}),drawer=html.slice(html.indexOf('<aside'));
    expect(drawer).not.toContain('⏱');expect(drawer).toMatch(/data-sticker="ui_clock_sand"[^>]*width="34"|width="34"[^>]*data-sticker="ui_clock_sand"/);
    expect(drawer).toMatch(/data-sticker="kungfu_po"[^>]*(width="116"|116px)|width="116"[^>]*data-sticker="kungfu_po"/);
    for(const id of ['ui_stat_damage_burst','ui_stat_ko_skull'])expect(drawer).toMatch(new RegExp(`data-sticker="${id}"[^>]*width="64"|width="64"[^>]*data-sticker="${id}"`));
    expect(drawer).toMatch(/visual-treasure-art[^>]*>[^]*?width="72"/);expect(drawer).toContain('data-sticker="ui_weapon_fragment"');
    expect(drawer).toMatch(/<dt>[^]*?<span class="settlement-sr-only">/);
  });
  it('shows the endless record as one short emblem capsule while keeping the full sentence for screen readers',()=>{
    const input=resultInput(),standardResult={...input.state.result!,loot:[...input.state.result!.loot]};
    Object.assign(input.state,{endless:true,wave:15,standardResult});
    Object.assign(input.state.result!,{endless:true,endlessWave:15,endlessCoins:90,endlessLoot:[],winner:'player',reason:'oranges'});
    input.profile.bestEndlessWave=18;
    const html=resultMarkup(input),capsule=html.match(/<p class="crest-endless-record"[\s\S]*?<\/p>/)![0];
    expect(capsule).toContain('data-sticker="ui_endless_emblem"');expect(capsule).toContain(t('p15.endlessCapsule',{wave:15,best:18}));
    expect(capsule).toContain(`class="settlement-sr-only">${t('p13.endlessRecord',{wave:15,best:18})}`);
  });
  it('swaps the pause tray fallback to the weapon fragment icon',()=>{
    const engine=new BattleEngine({autoWaves:false});engine.start();engine.state.sides.player.loot=['fake_fragment'];
    expect(pauseMarkup(engine.state)).toContain('data-sticker="ui_weapon_fragment"');
  });
  it('ships wholesome, complete zh-CN/en P15 copy',()=>{
    expect(Object.keys(p15En).sort()).toEqual(Object.keys(p15Zh).sort());
    for(const text of [...Object.values(p15Zh),...Object.values(p15En)]){expect(text.trim()).not.toBe('');expect(text).not.toMatch(/涩涩|色色|不许涩|Bonk|bonk|绝育|绿茶|疯批|舔狗|鸡你太/i);}
  });
});
