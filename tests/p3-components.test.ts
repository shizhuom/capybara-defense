import { afterEach, describe, expect, it } from 'vitest';
import { Compendium, COMPENDIUM_TABS } from '../src/ui/Compendium';
import { BattleEngine } from '../src/core/BattleEngine';
import { createProfile } from '../src/core/MetaProgression';
import { getBaseUnitStats } from '../src/core/UnitStats';
import { UNITS } from '../src/config/units';
import { setLanguage } from '../src/i18n/i18n';

afterEach(()=>setLanguage('zh-CN'));
describe('P3 visual compendium',()=>{
  it('defaults to the matrix with eight hero cells, one locked cell and four special recipes',()=>{
    const book=new Compendium(), html=book.markup(createProfile());
    expect(COMPENDIUM_TABS).toEqual(['matrix','pets','heroes','bosses','weapons','props']);
    expect(book.tab).toBe('matrix');
    expect(html.match(/data-matrix-cell=/g)).toHaveLength(9);
    expect(html.match(/data-special-recipe=/g)).toHaveLength(4);
    expect(html).toContain('data-matrix-cell="shiba:hat_wizard"');
    expect(html).toContain('data-action="compendium-hero:kungfu_po"');
    expect(html).toContain('data-sticker="ui_compendium_book"');
  });
  it('selects matrix details without leaving the matrix, and routes exact book targets',()=>{
    const book=new Compendium();
    book.selectHero('pepe_king');
    expect(book.tab).toBe('matrix');
    expect(book.markup(createProfile())).toContain('data-compendium-kind="pepe_king" data-compendium-focused="true"');
    book.openTo('meowfia');expect(book.tab).toBe('heroes');
    expect(book.markup(createProfile())).toContain('data-compendium-kind="meowfia" data-compendium-focused="true"');
    book.openTo('hat_wizard');expect(book.tab).toBe('pets');
    expect(book.markup(createProfile())).toContain('data-compendium-kind="hat_wizard" data-compendium-focused="true"');
    book.openTo('shovel');const html=book.markup(createProfile());
    expect(html.match(/data-entry=/g)).toHaveLength(19);expect(html).toContain('data-compendium-kind="shovel"');
    book.openTo('<invalid>');expect(book.tab).toBe('pets');expect(book.select('invalid')).toBe(false);
  });
  it.each(['zh-CN','en'] as const)('renders real catalogs, exact growth, one signature and two recommendations in %s',lang=>{
    setLanguage(lang);const book=new Compendium(), profile=createProfile();
    for(const [tab,count] of [['pets',19],['heroes',12],['bosses',17],['weapons',36],['props',20]] as const){
      book.select(tab);const html=book.markup(profile);
      expect(html.match(/data-entry=/g)).toHaveLength(count);
      expect(html).not.toMatch(/(?:p3|p1|hero|boss|enemy|weapon|prop)\.[a-z_]+(?:\.desc)?(?=[<\s])/);
      if(lang==='en')expect(html.replace(/<[^>]*>/g,'')).not.toMatch(/[\u3400-\u9fff]/);
      if(tab==='heroes'){
        expect(html.match(/data-weapon-role="signature"/g)).toHaveLength(12);
        expect(html.match(/data-weapon-role="recommendation"/g)).toHaveLength(24);
        expect(html).toContain('249.0368');
      }
    }
    book.openTo('hamster');expect(book.markup(profile)).toContain('18.6');expect(book.markup(profile)).toContain('1.4');
    book.openTo('panda');expect(book.markup(profile).match(/data-growth-unavailable=/g)).toHaveLength(4);
    book.openTo('bee');const bee=book.markup(profile);
    expect(bee.match(/data-growth-unavailable=/g)).toHaveLength(2);expect(bee).toContain('+2 / 7s');
    for(const kind of Object.keys(UNITS)){
      book.openTo(kind);const html=book.markup(profile);
      expect(html).toContain(`data-compendium-kind="${kind}" data-compendium-focused="true"`);
      expect(html).not.toMatch(/(?:p3|unit)\.[\w.]+(?=[<\s])/);
    }
  });
});

describe('P3 live unit card',()=>{
  async function setup(kind:string){
    const {liveUnitCardMarkup}=await import('../src/ui/LiveUnitCard');
    const engine=new BattleEngine({ai:false,autoWaves:false});engine.start();
    const id=engine.grant(kind).unitId!,unit=engine.state.units.find(u=>u.id===id)!;
    const render=()=>liveUnitCardMarkup({unit,state:engine.state,stats:engine.getEffectiveUnitStats(unit),loadout:engine.state.sides.player.loadout});
    return{engine,unit,render};
  }
  it('uses supplied effective stats and the frozen battle weapon, with accessible actions and docking',async()=>{
    setLanguage('en');const {engine,unit,render}=await setup('kungfu_po');
    engine.state.sides.player.loadout.equippedWeapons.kungfu_po='m10_bamboo_staff';
    unit.location={zone:'board',col:6,row:1};unit.statuses.WET=4;unit.energy=3;
    const html=render();expect(html).toContain('id="live-unit-card" class="live-unit-card dock-left"');
    expect(html).toContain('data-action="inspect-book:kungfu_po"');expect(html).toContain('data-action="clear"');
    expect(html).toContain('data-live-stat="damage">⚔ 60');expect(html).toContain('data-live-stat="rate">ϟ 0.77/s');
    expect(html).toContain('data-sticker="m10_bamboo_staff"');expect(html).toContain('Wet');expect(html).toContain('3/8');
    expect(html).toContain('data-live-energy-value');expect(html).toContain('aria-valuenow="3"');expect(html).toContain('width:37.5%');
    expect(html).toContain('data-sticker="ui_compendium_book"');
    unit.location={zone:'bench',slot:0};expect(render()).not.toContain('dock-left');
  });
  it('shows real partner availability and rejects self, other side, washing and merge locks',async()=>{
    const {engine,unit,render}=await setup('panda');
    expect(render()).not.toContain('partner-ready');
    const id=engine.grant('hat_bamboo').unitId!,other=engine.state.units.find(u=>u.id===id)!;
    expect(render()).toContain('partner-ready');
    for(const mutate of [()=>{other.washing=2;},()=>{other.washing=0;unit.washing=2;},()=>{unit.washing=0;other.statuses.MERGE_LOCK=2;},()=>{other.statuses={};other.side='ai';}]){mutate();expect(render()).not.toContain('partner-ready');}
  });
  it('shows matching-level basic upgrades, actual P3 next stats, and MAX',async()=>{
    const {engine,unit,render}=await setup('hamster');const id=engine.grant('hamster').unitId!,other=engine.state.units.find(u=>u.id===id)!;
    expect(render()).toContain('partner-ready');expect(render()).toContain('12 → 19');
    other.level=2;expect(render()).not.toContain('partner-ready');unit.level=5;expect(render()).toContain('MAX');
    expect(getBaseUnitStats('hamster',5).damage).toBeCloseTo(51.6);
  });
  it('marks feedable hero parts only when the selected hero can actually accept them',async()=>{
    const {engine,unit,render}=await setup('kungfu_po');engine.grant('panda');
    expect(render()).toContain('partner-ready');
    unit.statuses.MERGE_LOCK=3;expect(render()).not.toContain('partner-ready');
    unit.statuses={};unit.location={zone:'board',col:0,row:0};expect(render()).not.toContain('partner-ready');
    unit.location={zone:'bench',slot:0};unit.level=5;expect(render()).not.toContain('partner-ready');expect(render()).toContain('MAX');
  });
  it('keeps the battle weapon when the persistent profile is changed after battle setup',async()=>{
    const {liveUnitCardMarkup}=await import('../src/ui/LiveUnitCard');
    const profile=createProfile();profile.equippedWeapons.kungfu_po='m10_bamboo_staff';
    const engine=new BattleEngine({ai:false,autoWaves:false,loadouts:{player:profile}});engine.start();
    const id=engine.grant('kungfu_po').unitId!,unit=engine.state.units.find(u=>u.id===id)!;
    profile.equippedWeapons.kungfu_po='m01_swatter';
    const html=liveUnitCardMarkup({unit,state:engine.state,stats:engine.getEffectiveUnitStats(unit),loadout:engine.state.sides.player.loadout});
    expect(html).toContain('data-sticker="m10_bamboo_staff"');expect(html).not.toContain('data-sticker="m01_swatter"');
  });
  it('shows bee production with active overtime and level-three MAX, and shovel storage without combat pills',async()=>{
    const {engine,unit,render}=await setup('bee');unit.level=3;engine.state.sides.player.loadout.equippedPassiveProps=['bee_overtime'];
    expect(render()).toContain('+2 / 5.25s');expect(render()).toContain('MAX');expect(render()).not.toContain('data-live-stat="damage"');
    const tool=await setup('shovel');expect(tool.render()).toContain('data-action="store-shovel"');expect(tool.render()).not.toContain('data-live-stat="damage"');
  });
  it.each(['zh-CN','en'] as const)('resolves all live card variants and both dictionaries in %s',async lang=>{
    setLanguage(lang);const {p3En,p3Zh}=await import('../src/i18n/p3');expect(Object.keys(p3En).sort()).toEqual(Object.keys(p3Zh).sort());
    for(const kind of ['shiba','hat_wizard','bee','shovel','hamster','kungfu_po']){
      const {render}=await setup(kind);const html=render();expect(html).not.toMatch(/(?:p3|inspect|status)\.[\w.]+(?=[<\s])/);
      if(lang==='en')expect(html.replace(/<[^>]*>/g,'')).not.toMatch(/[\u3400-\u9fff]/);
    }
  });
});
