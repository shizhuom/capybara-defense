import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {Compendium} from '../src/ui/Compendium';
import {createProfile} from '../src/core/MetaProgression';
import {BattleEngine} from '../src/core/BattleEngine';
import {MetaScreens} from '../src/ui/MetaScreens';
import {ProfileScreens} from '../src/ui/ProfileScreens';
import {courtyardMarkup} from '../src/ui/CourtyardView';
import {pauseMarkup,resultMarkup} from '../src/ui/SettlementView';
import {setLanguage,t} from '../src/i18n/i18n';
import {p7En,p7Zh} from '../src/i18n/p7';
import {UNITS} from '../src/config/units';
import {HEROES} from '../src/config/heroes';
import {ENEMIES} from '../src/config/enemies';
import {WEAPONS} from '../src/config/weapons';
import {PROPS} from '../src/config/props';
import * as mergeTargets from '../src/core/MergeTargets';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {assets} from '../src/render/AssetRegistry';
import type {Interaction} from '../src/core/types';

afterEach(()=>{setLanguage('zh-CN');vi.restoreAllMocks();});
describe('P7 portrait compendium',()=>{
 it.each(['zh-CN','en'] as const)('resolves every detail, gallery and new phrase in %s',language=>{
  setLanguage(language);expect(Object.keys(p7Zh).sort()).toEqual(Object.keys(p7En).sort());
  for(const key of Object.keys(p7Zh))expect(t(key)).not.toBe(key);
  const book=new Compendium();
  for(const id of [...Object.keys(UNITS),...Object.keys(HEROES),...Object.keys(ENEMIES),...Object.keys(WEAPONS),...Object.keys(PROPS)]){
   book.openTo(id);const html=book.markup(createProfile()),text=html.replace(/<[^>]+>/g,'');
   expect(text).not.toMatch(/(?:p[1-7]|unit|hero|boss|enemy|weapon|prop|skill)\.[\w.]+/);
   if(language==='en')expect(text).not.toMatch(/[\u3400-\u9fff]/);
  }
 });
 it.each([['pets',19],['heroes',12],['bosses',17],['weapons',36],['props',20]] as const)('%s opens a clean portrait wall with %i entries', (tab,count)=>{
  const book=new Compendium();book.select(tab);const html=book.markup(createProfile());
  expect(html.match(/class="portrait-tile-button"/g)).toHaveLength(count);
  expect(html.match(/data-entry=/g)).toHaveLength(count);
  expect(html).not.toContain('book-growth');expect(html).not.toContain('book-stat-pills');
  const tabs=html.match(/class="encyclopedia-tabs ledger-tabs"[\s\S]*?<\/div>/)![0];
  expect(tabs.replace(/<[^>]+>/g,'')).not.toMatch(/\d/);
 });
 it('opens, cycles and returns to portraits; unknown IDs never corrupt a valid detail',()=>{
  const book=new Compendium(),p=createProfile();
  expect(book.inspectEntry('kungfu_po')).toBe(true);expect(book.tab).toBe('heroes');
  expect(book.markup(p)).toContain('compendium-detail-sheet');
  expect(book.markup(p)).toContain('data-compendium-kind="kungfu_po" data-compendium-focused="true"');
  expect(book.markup(p)).toContain('<td>328</td>');
  expect(book.markup(p).match(/data-weapon-role="signature"/g)).toHaveLength(1);
  expect(book.markup(p).match(/data-weapon-role="recommendation"/g)).toHaveLength(2);
  expect(book.stepDetail(-1)).toBe(true);expect(book.markup(p)).toContain('data-entry="pepe_king"');
  expect(book.stepDetail(1)).toBe(true);expect(book.inspectEntry('__proto__')).toBe(false);
  book.openTo('<invalid>');expect(book.closeDetail()).toBe('kungfu_po');
  expect(book.closeDetail()).toBeNull();expect(book.stepDetail(1)).toBe(false);
  expect(book.markup(p).match(/class="portrait-tile-button"/g)).toHaveLength(12);
 });
 it.each([['hamster','pets'],['box_kraken','bosses'],['m10_bamboo_staff','weapons'],['washer','props']] as const)('deep-links %s and resets to portraits on tab selection',(id,tab)=>{
  const book=new Compendium();book.openTo(id);expect(book.tab).toBe(tab);
  expect(book.markup(createProfile())).toContain(`data-compendium-kind="${id}" data-compendium-focused="true"`);
  book.select(tab);expect(book.markup(createProfile())).not.toContain('compendium-detail-sheet');
 });
 it('keeps matrix hero selection in the right panel but follows component recipe links to full hero details',()=>{
  const book=new Compendium();book.selectHero('puss_in_hat');expect(book.tab).toBe('matrix');
  book.openTo('hat_bamboo');book.selectHero('kungfu_po');expect(book.tab).toBe('heroes');
  expect(book.markup(createProfile())).toContain('compendium-detail-sheet');
 });
});

function mergeScene(){
 const engine=new BattleEngine({seed:718,autoWaves:false});engine.start();
 const grant=(kind:string)=>{const id=engine.grant(kind).unitId!;return engine.state.units.find(u=>u.id===id)!;};
 const panda=grant('panda'),cat=grant('cat');
 panda.location={zone:'board',col:2,row:1};cat.location={zone:'board',col:3,row:1};
 engine.state.grid[1][2]=engine.state.grid[1][3]='O';
 const hat=grant('hat_bamboo');return{engine,panda,cat,hat,grant};
}
function canvasSurface(){
 const calls:{name:string;args:any[]}[]=[],values:Record<string,unknown>={globalAlpha:1};
 const c=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return(s:string)=>({width:s.length*10});if(k.includes('Gradient'))return()=>({addColorStop(){}});return(...args:unknown[])=>calls.push({name:k,args});},set(v,k:string,value){v[k]=value;return true;}}) as unknown as CanvasRenderingContext2D;
 return {calls,renderer:new StickerRenderer({getContext:()=>c,width:0,height:0} as unknown as HTMLCanvasElement)};
}
describe('P7 multi-target synthesis perception',()=>{
 it('keeps top-row and adjacent outcome pills clear of HUD, unit cards and one another',()=>{
  const {engine,panda,cat,hat,grant}=mergeScene();
  panda.location={zone:'board',col:2,row:0};cat.location={zone:'board',col:8,row:0};
  const next=grant('panda');next.location={zone:'board',col:3,row:0};
  for(const u of [panda,cat,next])if(u.location.zone==='board')engine.state.grid[u.location.row][u.location.col]='O';
  const obstacles=[{x:0,y:0,w:1280,h:90},{x:950,y:80,w:316,h:330}];
  const {renderer,calls}=canvasSurface();
  renderer.draw(engine.state,0,{selectedId:hat.id,mergeAvoidRects:obstacles} as Interaction);
  const pills=calls.filter(c=>c.name==='fillText'&&String(c.args[0]).startsWith('→ ')).map(c=>({x:c.args[1]-36,y:c.args[2]-16,w:String(c.args[0]).length*10+46,h:32}));
  const overlap=(a:typeof pills[number],b:typeof pills[number])=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  expect(pills).toHaveLength(3);
  for(const [i,pill] of pills.entries()){
   expect(pill.x).toBeGreaterThanOrEqual(8);expect(pill.x+pill.w).toBeLessThanOrEqual(1272);
   expect(pill.y).toBeGreaterThanOrEqual(8);expect(pill.y+pill.h).toBeLessThanOrEqual(712);
   for(const obstacle of [...obstacles,...pills.slice(0,i)])expect(overlap(pill,obstacle)).toBe(false);
  }
 });
 it('marks both board partners and reports each resulting hero without changing legacy bench hints',()=>{
  const {engine,panda,cat,hat}=mergeScene();
  expect(mergeTargets.getBoardMergeHints(engine.state)).toEqual([{unitId:panda.id,col:2,row:1,kind:'hero'},{unitId:cat.id,col:3,row:1,kind:'hero'}]);
  expect(mergeTargets.getMergeTargets(engine.state,hat.id)).toEqual([{unitId:panda.id,kind:'hero',heroId:'kungfu_po',nextLevel:1},{unitId:cat.id,kind:'hero',heroId:'puss_in_hat',nextLevel:1}]);
  expect(mergeTargets.getBenchMergeHints(engine.state)).toEqual([{unitId:hat.id,slot:0,kind:'hero'}]);
 });
 it('distinguishes hero feeding and all matching same-level upgrades; excludes locked, washing and max units',()=>{
  const {engine,panda,cat,hat}=mergeScene();panda.kind='kungfu_po';panda.level=2;cat.kind='hamster';
  expect(mergeTargets.getMergeTargets(engine.state,hat.id)).toEqual([{unitId:panda.id,kind:'hero',heroId:'kungfu_po',nextLevel:3,feedHero:true}]);
  expect(mergeTargets.getBoardMergeHints(engine.state)).toEqual([{unitId:panda.id,col:2,row:1,kind:'upgrade'}]);
  panda.kind=hat.kind='hamster';panda.level=1;
  expect(mergeTargets.getMergeTargets(engine.state,hat.id)).toEqual([{unitId:panda.id,kind:'upgrade',nextLevel:2},{unitId:cat.id,kind:'upgrade',nextLevel:2}]);
  panda.statuses.MERGE_LOCK=2;cat.washing=2;expect(mergeTargets.getBoardMergeHints(engine.state)).toEqual([]);
  panda.statuses={};cat.washing=0;panda.level=cat.level=hat.level=5;expect(mergeTargets.getBoardMergeHints(engine.state)).toEqual([]);
 });
 it.each(['selectedId','previewSourceId','draggingId'] as const)('draws both result names AFTER every board and bench sprite for %s',mode=>{
  const {engine,hat}=mergeScene(),{renderer,calls}=canvasSurface();
  const sprites=new Map(['panda','cat','hat_bamboo','kungfu_po','puss_in_hat'].map(id=>[id,{id,naturalWidth:128,naturalHeight:128} as unknown as HTMLImageElement]));
  vi.spyOn(assets,'get').mockImplementation(id=>sprites.get(id));
  renderer.draw(engine.state,1,{[mode]:hat.id} as Interaction);
  const indices=['panda','cat','hat_bamboo'].map(id=>calls.findIndex(c=>c.name==='drawImage'&&c.args[0]?.id===id));
  const labels=calls.map((c,i)=>({c,i})).filter(({c})=>c.name==='fillText'&&['→ 功夫阿宝','→ 靴子剑客喵'].includes(c.args[0]));
  expect(labels).toHaveLength(2);for(const {i} of labels)expect(i).toBeGreaterThan(Math.max(...indices));
 });
 it('draws passive board sparkles and active green upgrade badges; suppresses merging during tool aiming',()=>{
  const {engine,panda,cat,hat}=mergeScene();panda.kind=cat.kind=hat.kind='hamster';
  const sparkle={id:'ui_merge_sparkle',naturalWidth:192,naturalHeight:192} as unknown as HTMLImageElement;
  vi.spyOn(assets,'get').mockImplementation(id=>id==='ui_merge_sparkle'?sparkle:undefined);
  const passive=canvasSurface();passive.renderer.draw(engine.state,1);
  expect(passive.calls.filter(c=>c.name==='drawImage'&&c.args[0]===sparkle)).toHaveLength(3);
  const active=canvasSurface();active.renderer.draw(engine.state,1,{selectedId:hat.id});
  expect(active.calls.filter(c=>c.name==='fillText'&&c.args[0]==='▲ 升至 Lv.2')).toHaveLength(2);
  const tool=canvasSurface();tool.renderer.draw(engine.state,1,{selectedId:hat.id,shovel:true});
  expect(tool.calls.filter(c=>c.name==='fillText'&&String(c.args[0]).startsWith('▲'))).toHaveLength(0);
 });
});
describe('P7 menu-only language controls and asset contracts',()=>{
 it.each(['zh-CN','en'] as const)('keeps language switching on the courtyard only (%s)',language=>{
  setLanguage(language);const p=createProfile();
  const meta=new MetaScreens(()=>p,()=>{},()=>{},()=>{}),screens=new ProfileScreens(()=>p,()=>true,()=>{},()=>{});
  const e=new BattleEngine({autoWaves:false});e.start();const pause=pauseMarkup(e.state);e.surrender();
  const pages=[new Compendium().markup(p),meta.markup('armory'),meta.markup('market'),...(['profile','leaderboard','settings'] as const).map(k=>screens.markup(k)),pause,resultMarkup({state:e.state,profile:p,savedResult:true,resultStars:0,previousRank:0,newWeapons:[],newAvatars:[]})];
  for(const html of pages){expect(html).not.toContain('dialog-language');expect(html).not.toMatch(/data-action="(?:zh-CN|en)"/);expect(html).toContain('class="compendium-toolbar"');}
  expect(courtyardMarkup(p)).toContain('data-action="zh-CN"');expect(courtyardMarkup(p)).toContain('data-action="en"');
 });
 it('preserves title and start-sticker PNG dimensions',()=>{
  for(const [id,w,h] of [['title_logo_zh',960,320],['title_logo_en',960,320],['ui_btn_start_zh',520,220],['ui_btn_start_en',520,220]] as const){
   const png=readFileSync(`public/assets/sprites/${id}.png`);expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([w,h]);
  }
 });
});
