import {afterEach,describe,expect,it} from 'vitest';
import {Compendium} from '../src/ui/Compendium';
import {ledger} from '../src/ui/LedgerView';
import {createProfile} from '../src/core/MetaProgression';
import {setLanguage,t} from '../src/i18n/i18n';
import {UNITS} from '../src/config/units';
import {HEROES} from '../src/config/heroes';
import {ENEMIES} from '../src/config/enemies';

const text=(html:string)=>html.replace(/<[^>]+>/g,'').replace(/&#(\d+);/g,(_,code:string)=>String.fromCodePoint(Number(code))).replace(/&amp;/g,'&');
const entry=(html:string,id:string)=>html.match(new RegExp(`<article[^>]*data-entry="${id}"[\\s\\S]*?</article>`))?.[0]??'';
const rows=(html:string)=>html.match(/<article class="portrait-tile [\s\S]*?<\/article>/g)??[];
afterEach(()=>setLanguage('zh-CN'));

describe('P10 storybook compendium',()=>{
  it.each(['zh-CN','en'] as const)('gives every roster entry and item category a resolved qualitative tagline in %s',language=>{
    setLanguage(language);
    const keys=[...Object.keys(UNITS).map(id=>`p10.unit.${id}`),...Object.keys(HEROES).map(id=>`p10.hero.${id}`),...Object.keys(ENEMIES).map(id=>`p10.enemy.${id}`),...['melee','ranged','magic'].map(id=>`p10.weapon.${id}`),...['active','passive'].map(id=>`p10.prop.${id}`)];
    for(const key of keys){
      const phrase=t(key);expect(phrase,key).not.toBe(key);expect(phrase.length,key).toBeGreaterThan(7);expect(phrase,key).not.toMatch(/\d/);
      if(language==='en')expect(phrase,key).not.toMatch(/[\u3400-\u9fff]/);
    }
  });

  it.each([['pets',19],['heroes',12],['bosses',17],['weapons',36],['props',20]] as const)('renders %s as readable storybook rows without leaking stats', (tab,count)=>{
    const book=new Compendium();book.select(tab);
    for(const language of ['zh-CN','en'] as const){
      setLanguage(language);const html=book.markup({...createProfile(),highestStars:20},false),cards=rows(html);
      expect(cards).toHaveLength(count);expect(html.match(/class="portrait-tile-button"/g)).toHaveLength(count);expect(html.match(/data-entry=/g)).toHaveLength(count);
      expect(html).not.toContain('book-growth');expect(html).not.toContain('book-stat-pills');
      for(const card of cards){
        expect(card).toContain(`class="storybook-frame tone-${tab}"`);expect(card).toContain('class="storybook-copy"');expect(card).toContain('class="storybook-tagline"');expect(card).toContain('class="storybook-status"');expect(card).toContain('class="storybook-mark" aria-hidden="true"');
        expect(text(card)).not.toMatch(/\d/);expect(text(card)).not.toMatch(/(?:p10|unit|hero|boss|enemy|weapon|prop)\.[\w.]+/);
        if(language==='en')expect(text(card)).not.toMatch(/[\u3400-\u9fff]/);
      }
    }
  });

  it.each([['zh-CN','可合成','已收录','待收集','已拥有'],['en','Can merge','Recorded','To collect','Owned']] as const)('distinguishes available heroes, recorded creatures and unowned items in %s',(language,canMerge,recorded,toCollect,owned)=>{
    setLanguage(language);const book=new Compendium(),profile=createProfile();book.select('heroes');
    let html=book.markup(profile,false),ready=entry(html,'kungfu_po'),locked=entry(html,'pepe_king');
    expect(text(ready)).toContain(canMerge);expect(ready).toContain('storybook-awaiting');expect(ready).not.toContain('data-sticker="ui_storybook_check"');
    expect(locked).toContain('mystery-art');expect(locked).toContain('★20');expect(locked).toContain('data-sticker="ui_lock_closed"');expect(locked).not.toContain('data-sticker="ui_storybook_check"');
    html=book.markup({...profile,mergedHeroes:['kungfu_po']},false);expect(text(entry(html,'kungfu_po'))).toContain(recorded);expect(entry(html,'kungfu_po')).toContain('data-sticker="ui_storybook_check"');
    expect(html.match(/class="portrait-tile encyclopedia-card rarity-4 collected"/g)).toHaveLength(1);
    for(const [tab,id] of [['pets','hamster'],['bosses','rat']] as const){book.select(tab);expect(entry(book.markup(profile,false),id)).toContain('data-sticker="ui_storybook_check"');}
    for(const [tab,id] of [['weapons','m10_bamboo_staff'],['props','washer']] as const){
      book.select(tab);const unowned=entry(book.markup(profile,false),id);expect(text(unowned)).toContain(toCollect);expect(unowned).toContain('data-sticker="ui_lock_closed"');expect(unowned).not.toContain('data-sticker="ui_storybook_check"');
      const collected=entry(book.markup({...profile,unlockedWeapons:['m10_bamboo_staff'],ownedProps:{washer:1}},false),id);expect(text(collected)).toContain(owned);expect(collected).toContain('data-sticker="ui_storybook_check"');
    }
  });

  it('starts the matrix with every recipe, then focused details and a collapsible reference',()=>{
    const book=new Compendium(),profile={...createProfile(),highestStars:20};
    const initial=book.markup(profile,false);
    expect(initial.match(/data-storybook-recipe=/g)).toHaveLength(12);expect(initial).not.toContain('class="portrait-tile');expect(initial).not.toContain('data-entry=');
    expect(initial.indexOf('storybook-recipe-list')).toBeLessThan(initial.indexOf('class="compendium-detail"'));
    expect(initial.indexOf('class="compendium-detail"')).toBeLessThan(initial.indexOf('class="storybook-matrix-reference"'));
    expect(initial).toContain('<details class="storybook-matrix-reference"><summary>');
    expect(initial.match(/data-matrix-cell=/g)).toHaveLength(9);expect(initial.match(/data-special-recipe=/g)).toHaveLength(4);expect(initial).toContain('matrix-corner');
    for(const damage of [38,61,97,156,249])expect(initial).toContain(`<td>${damage}</td>`);
    book.selectHero('puss_in_hat');const selected=book.markup(profile,false);
    expect(book.tab).toBe('matrix');expect(selected).toContain('data-compendium-kind="puss_in_hat" data-compendium-focused="true" tabindex="-1"');
    expect(selected).toContain('data-action="compendium-hero:puss_in_hat" aria-pressed="true"');
  });

  it('keeps locked, grandfathered and test-profile entry routes honest after the row redesign',()=>{
    const book=new Compendium(),profile=createProfile();book.openTo('pepe_king');
    let html=book.markup(profile,false);expect(html).toContain('locked-entry-notice');expect(html).not.toContain('book-growth');
    html=book.markup({...profile,mergedHeroes:['pepe_king']},false);expect(html).toContain('book-growth');expect(html).toContain('storybook-frame');
    expect(book.markup(profile,true)).toContain('book-growth');
    book.openTo('frog');expect(book.markup({...profile,mergedHeroes:['pepe_king']},false)).not.toContain('locked-entry-notice');
    book.openTo('shovel');expect(book.markup(profile,false)).toContain(t('p10.unit.shovel'));expect(book.closeDetail()).toBe('shovel');expect(rows(book.markup(profile,false))).toHaveLength(19);
    book.openTo('hat_bamboo');book.selectHero('kungfu_po');expect(book.tab).toBe('heroes');expect(book.markup(profile,false)).toContain('compendium-detail-sheet');
  });

  it.each([['zh-CN','萌宠图鉴'],['en','Compendium']] as const)('keeps the Compendium mascot distinct while sharing the storybook shell (%s)',(language,title)=>{
    setLanguage(language);const html=new Compendium().markup(createProfile(),false);
    expect(html).toContain(`id="dialog-title">${title}</h2>`);expect(html).toContain('data-sticker="ui_compendium_peek_capy"');expect(html.match(/class="tab-icon" aria-hidden="true"/g)).toHaveLength(6);
    expect(html).toContain('data-sticker="ui_compendium_book"');expect(html).toContain('0/12');expect(html).toContain('0/36');
    expect(html).toContain('class="storybook-footer-tip"');expect(html).toContain(t('p10.footerTip1').replace(/&/g,'&amp;'));expect(html).toContain(t('p10.footerTip2').replace(/&/g,'&amp;'));
    expect(html.match(/data-action="close-recipes"/g)).toHaveLength(1);expect(html.indexOf('data-action="close-recipes"')).toBeLessThan(html.indexOf('class="p3-compendium"'));
    for(const page of ['armory','market','profile','leaderboard','settings'] as const){
      const other=ledger(page,'<p>Page content</p>');expect(other).toContain('storybook-footer-tip');expect(other).not.toContain('ui_compendium_peek_capy');expect(other).toContain('ledger-tabs');
    }
  });
});
