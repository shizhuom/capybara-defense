import {afterEach,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {Compendium} from '../src/ui/Compendium';
import {createProfile} from '../src/core/MetaProgression';
import {BattleEngine} from '../src/core/BattleEngine';
import {MetaScreens} from '../src/ui/MetaScreens';
import {ProfileScreens} from '../src/ui/ProfileScreens';
import {courtyardMarkup} from '../src/ui/CourtyardView';
import {pauseMarkup,resultMarkup} from '../src/ui/SettlementView';
import {setLanguage} from '../src/i18n/i18n';

afterEach(()=>setLanguage('zh-CN'));
describe('P7 portrait compendium',()=>{
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
  expect(book.markup(p)).toContain('<td>249</td>');
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
