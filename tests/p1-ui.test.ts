import { afterEach, describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import { createProfile } from '../src/core/MetaProgression';
import { getBossHUD, getWaveHUD, getMusicMode, isDeveloperMode } from '../src/ui/BattleHUD';
import { Compendium } from '../src/ui/Compendium';
import { p1En, p1Zh } from '../src/i18n/p1';
import { setLanguage, t } from '../src/i18n/i18n';
import { BOSS_IDS, ENEMIES } from '../src/config/enemies';
import { RARITY_RULES, WEAPONS } from '../src/config/weapons';
import { GameApp } from '../src/ui/GameApp';
import type { CommandResult } from '../src/core/types';
import type { TutorialStep } from '../src/core/Tutorial';

afterEach(() => setLanguage('zh-CN'));
describe('P1 player presentation selectors', () => {
  it('uses the specified developer sandbox label in both languages', () => {
    setLanguage('zh-CN'); expect(t('p1.developer')).toBe('开发者沙盒面板');
    setLanguage('en'); expect(t('p1.developer')).toBe('Developer Sandbox');
  });
  it('uses chill music for browsing, battle music for play and boss music only while active', () => {
    const engine=new BattleEngine({ai:false,autoWaves:false});engine.start();
    expect(getMusicMode()).toBe('menu');expect(getMusicMode(engine.state)).toBe('battle');
    const boss=engine.spawnEnemy('king_skunk','player');expect(getMusicMode(engine.state)).toBe('boss');
    expect(getMusicMode(engine.state,true)).toBe('menu');
    engine.pause(true);expect(getMusicMode(engine.state)).toBe('menu');engine.pause(false);
    boss.hp=0;expect(getMusicMode(engine.state)).toBe('battle');
    engine.state.phase='finished';expect(getMusicMode(engine.state)).toBe('menu');
  });
  it('defaults to a clean view, accepts only dev=1 or the saved setting', () => {
    expect(isDeveloperMode('', {})).toBe(false);
    expect(isDeveloperMode('?dev=0', {})).toBe(false);
    expect(isDeveloperMode('?dev=true', {})).toBe(false);
    expect(isDeveloperMode('?foo=1&dev=1', {})).toBe(true);
    expect(isDeveloperMode('', {developerMode:true})).toBe(true);
  });
  it('selects the nearest live player boss and excludes the other lane', () => {
    const engine = new BattleEngine({seed:34, ai:false, autoWaves:false}); engine.start();
    const a = engine.spawnEnemy('box_kraken','player');
    const b = engine.spawnEnemy('husky_wrecker','player');
    engine.spawnEnemy('king_skunk','ai').progress=14;
    a.progress=2; b.progress=8; b.hp=300; b.abilityCooldown=1.6;
    expect(getBossHUD(engine.state)).toMatchObject({id:b.id, count:2, hp:300, maxHp:b.maxHp, warning:true, cooldown:2});
    b.hp=0; expect(getBossHUD(engine.state)?.id).toBe(a.id);
    a.hp=0; expect(getBossHUD(engine.state)).toBeNull();
  });
  it('keeps preparation, wave and boss progress bounded and distinct', () => {
    const engine = new BattleEngine({seed:35, ai:false, autoWaves:false}); engine.start();
    engine.state.wave=1; engine.state.waveTime=9;
    expect(getWaveHUD(engine.state)).toMatchObject({kind:'preparation', fraction:.5, remaining:9});
    const preview=engine.spawnEnemy('husky_wrecker','player');
    expect(getWaveHUD(engine.state).kind).toBe('boss'); preview.hp=0;
    engine.state.waveTime=22;
    expect(getWaveHUD(engine.state).kind).toBe('wave');
    engine.spawnEnemy('box_kraken','player');
    expect(getWaveHUD(engine.state).kind).toBe('boss');
    engine.state.waveTime=1000; expect(getWaveHUD(engine.state).fraction).toBeLessThanOrEqual(1);
  });
});
describe('P1 bilingual encyclopedia', () => {
  it.each(['zh-CN','en'] as const)('shows each weapon current unlock state and its fragment requirement in %s', lang => {
    setLanguage(lang);
    const book=new Compendium(), profile=createProfile(); book.tab='weapons';
    const ids=Object.keys(WEAPONS), unlocked=t('p5.collected'), locked=t('p5.locked');
    for(const unlockedIds of [[],[ids[1]],ids]) {
      profile.unlockedWeapons=[...unlockedIds];
      book.select('weapons');
      const html=book.markup(profile);
      expect(html.match(/data-entry=/g)).toHaveLength(36);
      for(const weapon of Object.values(WEAPONS)) {
        const card=html.match(new RegExp(`<article[^>]*data-entry="${weapon.id}"[\\s\\S]*?</article>`))?.[0];
        expect(card).toContain(`<b class="collection-state">${unlockedIds.includes(weapon.id)?unlocked:locked}</b>`);
        const count=RARITY_RULES[weapon.rarity].fragments;
        expect(card).not.toContain('book-stats');
        book.inspectEntry(weapon.id);
        expect(book.markup(profile)).toContain(lang==='en'?`Unlock with ${count} fragments`:`收集 ${count} 枚碎片解锁`);
      }
    }
  });
  it.each(['zh-CN','en'] as const)('shows configured armor percentages for all twelve bosses in %s', lang => {
    setLanguage(lang);
    const book=new Compendium(); book.tab='bosses';
    expect(book.markup(createProfile()).match(/data-entry=/g)).toHaveLength(17);
    for(const id of BOSS_IDS) {
      book.inspectEntry(id);const html=book.markup({...createProfile(),highestStars:20});
      const card=html.match(new RegExp(`<article[^>]*data-entry="${id}"[\\s\\S]*?</article>`))?.[0];
      expect(card).toContain(`${lang==='en'?'Armor':'护甲'} ${Math.round(ENEMIES[id].armor*100)}%`);
    }
  });
  it.each(['heroes','bosses','weapons','props'] as const)('renders every %s card with resolved bilingual text', tab => {
    const counts={heroes:12,bosses:17,weapons:36,props:20};
    const book=new Compendium(); book.tab=tab;
    for(const lang of ['zh-CN','en'] as const) {
      setLanguage(lang); const html=book.markup(createProfile());
      expect((html.match(/data-entry=/g)??[])).toHaveLength(counts[tab]);
      expect(html).not.toMatch(/(?:p1|hero|boss|weapon|prop)\.[a-z_]+(?:\.desc)?(?=[<\s])/);
      if(lang==='en') expect(html.replace(/<[^>]*>/g,'')).not.toMatch(/[\u3400-\u9fff]/);
    }
  });
  it('marks only actually merged heroes as collected', () => {
    const book=new Compendium(), profile=createProfile(); book.select('heroes'); profile.mergedHeroes=['kungfu_po'];
    const html=book.markup(profile);
    expect((html.match(/class="portrait-tile encyclopedia-card rarity-4 collected"/g)??[])).toHaveLength(1);
    expect(html).toContain('data-entry="kungfu_po"');
  });
  it('covers all new phrases and all twelve counter tips in both languages', () => {
    expect(Object.keys(p1Zh).sort()).toEqual(Object.keys(p1En).sort());
    for(const id of BOSS_IDS) {
      expect(p1Zh[`p1.boss.${id}.tip`]?.length).toBeGreaterThan(10);
      expect(p1En[`p1.boss.${id}.mechanic`]?.length).toBeGreaterThan(10);
    }
  });
});

describe('P1 tutorial command integration', () => {
  // Exercise the real command handler and tutorial progression without mounting the DOM or audio.
  function appFor(engine:BattleEngine) {
    const app=Object.create(GameApp.prototype) as {
      engine:BattleEngine; tutorialStep:TutorialStep; apply(result:CommandResult):void;
      refresh():void; notify():void; sound:{play():void};
    };
    Object.assign(app,{engine,tutorialStep:2,refresh:()=>{},notify:()=>{},sound:{play:()=>{}}});
    return app;
  }
  it('keeps step 2 after a bench merge and empty-bench move, then advances after a real board deployment', () => {
    const engine=new BattleEngine({seed:74,ai:false,autoWaves:false}); engine.start();
    const app=appFor(engine);
    const first=engine.grant('hamster').unitId!, second=engine.grant('hamster').unitId!, third=engine.grant('squirrel').unitId!;
    app.apply(engine.move(first,{zone:'bench',slot:1}));
    expect(engine.state.units.some(unit=>unit.id===second&&unit.level===2)).toBe(true);
    expect(app.tutorialStep).toBe(2);
    const benchMove=engine.move(third,{zone:'bench',slot:0});
    expect(benchMove).toMatchObject({ok:true,key:'hint.deployed'});
    app.apply(benchMove); expect(app.tutorialStep).toBe(2);
    const blocked=engine.move(third,{zone:'board',col:0,row:0});
    expect(blocked.ok).toBe(false); app.apply(blocked); expect(app.tutorialStep).toBe(2);
    const deployed=engine.move(third,{zone:'board',col:2,row:1});
    expect(deployed).toMatchObject({ok:true,key:'hint.deployed'});
    app.apply(deployed); expect(app.tutorialStep).toBe(3);
  });
  it('advances step 2 only after digging succeeds', () => {
    const engine=new BattleEngine({seed:75,ai:false,autoWaves:false}); engine.start();
    const app=appFor(engine); engine.state.sides.player.shovels=0;
    const failed=engine.dig(0,1); expect(failed.ok).toBe(false);
    app.apply(failed); expect(app.tutorialStep).toBe(2);
    engine.state.sides.player.shovels=1;
    const dug=engine.dig(0,1); expect(dug).toMatchObject({ok:true,key:'hint.dig'});
    app.apply(dug); expect(engine.state.grid[1][0]).toBe('O'); expect(app.tutorialStep).toBe(3);
  });
});
