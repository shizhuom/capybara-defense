import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {PROGRESSION_TIERS,getUnlockedUnitIds,getUnlockedHeroIds,getUnlockedMinionIds,getUnlockedBossIds,requiredStars,progressionFor} from '../src/config/progression';
import {BattleEngine} from '../src/core/BattleEngine';
import {pickBattleMap,getUnlockedMaps} from '../src/core/PlayerProgression';
import {Random} from '../src/core/Random';
import {emptyProfile} from '../src/ui/storage';
import {setLanguage,t} from '../src/i18n/i18n';
import {ENEMIES} from '../src/config/enemies';
import {WAVES} from '../src/config/waves';

describe('P9 historical star progression',()=>{
 it('unlocks precisely the safe first roster and the full final roster',()=>{
  expect(getUnlockedUnitIds(0)).toEqual(['hamster','squirrel','bee','shovel','panda','cat','hat_bamboo']);
  expect(getUnlockedHeroIds(0)).toEqual(['kungfu_po','puss_in_hat']);expect(getUnlockedMinionIds(0)).toEqual(['rat','roach']);expect(getUnlockedBossIds(0)).toEqual(['husky_wrecker']);
  expect([getUnlockedUnitIds(20).length,getUnlockedHeroIds(20).length,getUnlockedMinionIds(20).length,getUnlockedBossIds(20).length]).toEqual([20,12,5,12]);
  for(const getter of [getUnlockedUnitIds,getUnlockedHeroIds,getUnlockedMinionIds,getUnlockedBossIds])for(let i=1;i<PROGRESSION_TIERS.length;i++)expect(getter(PROGRESSION_TIERS[i].stars)).toEqual(expect.arrayContaining(getter(PROGRESSION_TIERS[i-1].stars)));
 });
 it('keeps historical stars and previously earned heroes/components without opening unrelated content',()=>{
  const p={...emptyProfile(),stars:0,highestStars:4,mergedHeroes:['ronin_goose']};const unlocked=progressionFor(p);
  expect(unlocked.heroes).toContain('ronin_goose');expect(unlocked.units).toEqual(expect.arrayContaining(['goose','cleaver','shiba']));expect(unlocked.units).not.toContain('crown');expect(requiredStars('pepe_king')).toBe(20);
  expect(progressionFor({...p,highestStars:0,mergedHeroes:['zen_master']}).heroes).toContain('purrcerer');
 });
 it('leaves legacy deterministic draws unrestricted; restricts all ordinary summons at zero stars',()=>{
  const a=new BattleEngine({seed:71,autoWaves:false}),b=new BattleEngine({seed:71,autoWaves:false,progressionStars:undefined});a.start();b.start();
  const restricted=new BattleEngine({seed:71,autoWaves:false,progressionStars:0});restricted.start();
  for(let i=0;i<45;i++){for(const e of [a,b,restricted]){e.addFood(500);e.summon();}expect(a.state.units.map(u=>u.kind)).toEqual(b.state.units.map(u=>u.kind));expect(restricted.state.units.every(u=>getUnlockedUnitIds(0).includes(u.kind))).toBe(true);}
 });
 it('freezes transition preparation independently of the tutorial and disallows early calls',()=>{
  const e=new BattleEngine({seed:2});e.start();e.setTransitionHold(true);e.tick(2);expect(e.state.waveTime).toBe(0);expect(e.state.nextSpawn).toBe(18);expect(e.canCallEarlyWave().allowed).toBe(false);
  e.setTutorialHold(true);e.setTransitionHold(false);e.tick(1);expect(e.state.nextSpawn).toBe(18);e.setTutorialHold(false);e.tick(1);expect(e.state.nextSpawn).toBeCloseTo(17);
 });
 it('filters scheduled monsters and previews without changing count or wave HP scaling',()=>{
  const e=new BattleEngine({seed:5,progressionStars:0});e.start();
  for(let i=0;i<9;i++){const preview=e.getUpcomingWavePreview();expect(preview?.bosses.every(id=>id==='husky_wrecker')).toBe(true);e.skipWave();}
  const enemy=e.spawnEnemy('crab','player',WAVES[9].hpScale);expect(enemy.kind).toBe('rat');expect(enemy.maxHp).toBe(ENEMIES.rat.hp*WAVES[9].hpScale);expect(e.currentWaveTargetCount()).toBe(26);
 });
 it('emits first-per-wave elite alerts plus typed impacts and original-family death metadata',()=>{
  const e=new BattleEngine({seed:3});e.start();e.spawnEnemy('crab','player');e.spawnEnemy('crab','player');expect(e.state.events.filter(v=>v.effect==='elite_spawn')).toHaveLength(1);
  e.skipWave();e.spawnEnemy('crab','player');expect(e.state.events.filter(v=>v.effect==='elite_spawn')).toHaveLength(2);
  e.grant('squirrel');const target=e.spawnEnemy('rat','player');e.hurt(target,1000,e.state.units[0]);
  expect([...e.state.events].reverse().find(v=>v.type==='damage')?.hitCue).toBe('hit_ranged');expect([...e.state.events].reverse().find(v=>v.type==='death')).toMatchObject({enemyKind:'rat',boss:false});
 });
});
describe('P9 labels, assets and deterministic random maps',()=>{
 it('samples every unlocked map without altering deterministic preview behavior',()=>{
  setLanguage('zh-CN');expect(t('p3.auto')).toBe('随机');expect(t('m3.autoMap')).toBe('随机（已解锁地图）');
  const p={...emptyProfile(),stars:150,highestStars:150};const rng=new Random(321);
  expect(new Set(Array.from({length:100},()=>pickBattleMap(p,()=>rng.next()).id))).toEqual(new Set(getUnlockedMaps(p)));
  p.selectedMap='sakura_onsen';expect(pickBattleMap(p,()=>0).id).toBe('sakura_onsen');
 });
 it('keeps all player strings wholesome',()=>{
  for(const dir of ['src/i18n','src/config'])for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')))expect(readFileSync(`${dir}/${file}`,'utf8'),file).not.toMatch(/涩涩|色色|不许涩|Bonk|bonk|绝育|绿茶|疯批|舔狗|鸡你太/i);
 });
 it('loads 288 sprites with the eight new v2 IDs',()=>{
  const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8'));expect(ids).toHaveLength(288);
  for(const id of ['npc_shop_raccoon','npc_blacksmith_capy','ui_gacha_machine','ui_trunk_crate','ui_battle_clash_crest','ui_crossed_blades','ui_alert_siren','ui_unlock_chest'])expect(ids).toContain(id);
 });
});
