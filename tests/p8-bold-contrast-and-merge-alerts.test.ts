import {afterEach,describe,it,expect,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {GameApp} from '../src/ui/GameApp';
import {RECIPES} from '../src/config/recipes';
import * as hints from '../src/core/MergeTargets';
import {setLanguage} from '../src/i18n/i18n';
import type {Unit} from '../src/core/types';

afterEach(()=>{vi.restoreAllMocks();setLanguage('zh-CN');});
function battle(){const e=new BattleEngine({seed:808,autoWaves:false});e.start();return e;}
function add(e:BattleEngine,kind:string,zone:'board'|'bench'='board'):Unit {
 const id=e.grant(kind).unitId!,u=e.state.units.find(u=>u.id===id)!;
 if(zone==='board'){
  const row=e.state.grid.findIndex((r,y)=>r.some((t,x)=>['G','O'].includes(t)&&!e.state.units.some(v=>v.location.zone==='board'&&v.location.col===x&&v.location.row===y)));
  const col=e.state.grid[row].findIndex((t,x)=>['G','O'].includes(t)&&!e.state.units.some(v=>v.location.zone==='board'&&v.location.col===x&&v.location.row===row));
  e.state.grid[row][col]='O';expect(e.move(id,{zone:'board',col,row}).ok).toBe(true);
 }
 return u;
}
function appFor(engine:BattleEngine){
 const badge:any={hidden:true,textContent:'',setAttribute:vi.fn()};
 const app:any=Object.create(GameApp.prototype);
 Object.assign(app,{engine,tutorialStep:'done',sound:{play:vi.fn()},refresh:vi.fn(),notify:vi.fn(),progressTutorial:vi.fn(),meta:{action:()=>false},profileScreens:{action:()=>false},element:()=>badge});
 return{app,badge};
}

describe('P8 full-field merge metadata',()=>{
 it.each(RECIPES.flatMap(r=>(['board-board','board-bench','bench-bench'] as const).map(z=>({r,z}))))('$r.hero in $z gives both parts the same hero badge',({r,z})=>{
  const e=battle(),[za,zb]=z.split('-') as ['board'|'bench','board'|'bench'];
  const a=add(e,r.parts[0],za),b=add(e,r.parts[1],zb),all=hints.getPassiveMergeCallouts(e.state);
  expect(all).toHaveLength(2);for(const u of [a,b])expect(all.find(h=>h.unitId===u.id)).toMatchObject({unitId:u.id,zone:u.location.zone,kind:'hero',heroId:r.hero,partnerIds:[u===a?b.id:a.id]});
  expect(hints.getHeroMergeOptions(e.state)).toEqual([{heroId:r.hero,sourceId:a.id,targetId:b.id}]);
 });
 it('prioritizes a new hero, reports both sides of feed/upgrade, and excludes washing/merge-lock/max levels/tools',()=>{
  const e=battle(),hero=add(e,'kungfu_po'),panda=add(e,'panda'),hat=add(e,'hat_bamboo','bench');
  expect(hints.getPassiveMergeCallouts(e.state).find(h=>h.unitId===panda.id)).toMatchObject({kind:'hero',heroId:'kungfu_po'});
  e.state.units=e.state.units.filter(u=>u.id!==hat.id);
  expect(hints.getPassiveMergeCallouts(e.state).map(h=>[h.kind,h.nextLevel])).toEqual([['upgrade',2],['upgrade',2]]);
  expect(hints.getHeroMergeOptions(e.state)).toEqual([]);hero.level=5;expect(hints.getPassiveMergeCallouts(e.state)).toEqual([]);
  hero.kind=panda.kind='hamster';hero.level=1;expect(hints.getPassiveMergeCallouts(e.state)).toHaveLength(2);
  hero.statuses.MERGE_LOCK=5;expect(hints.getPassiveMergeCallouts(e.state)).toEqual([]);
  hero.statuses={};panda.washing=2;expect(hints.getPassiveMergeCallouts(e.state)).toEqual([]);
  panda.washing=0;add(e,'shovel','bench');expect(hints.getPassiveMergeCallouts(e.state)).toHaveLength(2);
 });
});
describe('P8 selection and hero locator',()=>{
 it('clears ordinary summon/deployment selection while preserving selected merge results',()=>{
  const e=battle(),{app}=appFor(e);app.selectedId=998;app.action('summon');expect(app.selectedId).toBeUndefined();
  e.state.units=[];const a=add(e,'hamster','bench');app.selectedId=a.id;app.activate({kind:'cell',col:2,row:1});expect(app.selectedId).toBeUndefined();
  const b=add(e,'hamster','bench');app.selectedId=b.id;app.activate({kind:'cell',col:2,row:1});expect(app.selectedId).toBe(a.id);expect(e.state.units.find(u=>u.id===a.id)?.level).toBe(2);
 });
 it('shows board-only special recipes and cycles current valid heroes without stale selections',()=>{
  const e=battle(),goose=add(e,'goose'),knife=add(e,'cleaver'),frog=add(e,'frog'),crown=add(e,'crown');
  const{app,badge}=appFor(e);app.renderHeroMergeAlert(e.state);expect(badge.hidden).toBe(false);expect(badge.textContent).toContain('无名刀鹅');
  app.action('focus-hero-merge');expect(app.selectedId).toBe(goose.id);
  app.action('focus-hero-merge');expect(app.selectedId).toBe(frog.id);
  e.state.units=e.state.units.filter(u=>u.id!==crown.id);app.action('focus-hero-merge');expect(app.selectedId).toBe(goose.id);
  e.state.units=e.state.units.filter(u=>u.id!==knife.id);app.renderHeroMergeAlert(e.state);expect(badge.hidden).toBe(true);
 });
 it('keeps multiple copies of one recipe a single locator option and suppresses the locator while aiming',()=>{
  const e=battle();add(e,'goose');add(e,'goose');add(e,'cleaver');expect(hints.getHeroMergeOptions(e.state)).toHaveLength(1);
  const{app,badge}=appFor(e);for(const props of [{drag:{id:1,moved:false}},{selectedProp:'washer'},{shovelSelected:true}]){Object.assign(app,{drag:undefined,selectedProp:undefined,shovelSelected:false},props);app.renderHeroMergeAlert(e.state);expect(badge.hidden).toBe(true);}
 });
});
