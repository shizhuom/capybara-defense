import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {assets} from '../src/render/AssetRegistry';
import {P11_SCENE_IDS,sceneSticker} from '../src/ui/stickers';
import {ledger} from '../src/ui/LedgerView';
import {createProfile} from '../src/core/MetaProgression';
import {setLanguage,t} from '../src/i18n/i18n';
import {p11Zh,p11En} from '../src/i18n/p11';

afterEach(()=>{vi.restoreAllMocks();setLanguage('zh-CN');});
describe('P11 shared illustrated folder',()=>{
 it('keeps every new phrase bilingual without raw keys',()=>{
  expect(Object.keys(p11Zh).sort()).toEqual(Object.keys(p11En).sort());
  for(const lang of ['zh-CN','en'] as const){setLanguage(lang);for(const key of Object.keys(p11Zh)){expect(t(key)).not.toBe(key);expect(t(key).length).toBeGreaterThan(0);}}
 });
 it('ships 288 synchronized sprites with four transparent, borderless peeking mascots',()=>{
  const root='public/assets/sprites/',ids=JSON.parse(readFileSync(root+'manifest.json','utf8')) as string[];
  expect(ids).toHaveLength(288);expect(new Set(ids).size).toBe(288);expect(readdirSync(root).filter(f=>f.endsWith('.png'))).toHaveLength(288);
  expect(P11_SCENE_IDS).toEqual(['ui_armory_peek_capy','ui_market_peek_raccoon','ui_rank_peek_capy','ui_profile_peek_capy']);
  vi.spyOn(assets,'get').mockReturnValue(undefined);
  const fallbacks=P11_SCENE_IDS.map(id=>{expect(ids).toContain(id);const png=readFileSync(root+id+'.png');expect([png.readUInt32BE(16),png.readUInt32BE(20),png[25]]).toEqual([256,256,6]);return sceneSticker(id,'',78);});
  expect(new Set(fallbacks).size).toBe(4);
  for(const svg of fallbacks){expect(svg).toContain('<svg');expect(svg).not.toContain('stroke="#fffdf6"');}
 });
 it.each(['zh-CN','en'] as const)('renders one calm header and one tab bar in %s',lang=>{
  setLanguage(lang);const profile=createProfile();
  for(const [page,mascot] of [['armory','ui_armory_peek_capy'],['market','ui_market_peek_raccoon'],['leaderboard','ui_rank_peek_capy'],['profile','ui_profile_peek_capy'],['settings','ui_profile_peek_capy']] as const){
   const html=ledger(page,'<p>content</p>',{profile});
   expect(html).toContain(`data-sticker="${mascot}"`);expect(html).toContain('storybook-footer-tip');
   expect(html.match(/class="ledger-tabs/g)).toHaveLength(1);expect(html).not.toContain('ledger-wallet');
   expect(html).not.toContain('dialog-language');expect(html).not.toMatch(/>p11\./);
   expect(html).toContain('class="compendium-toolbar"><button');
   expect(html.match(/class="collection-badge"/g)?.length??0).toBe(page==='settings'?0:1);
  }
 });
 it('keeps preparation notices and cross-page links out of the sole top tab bar',()=>{
  const profile=createProfile();
  const tabs='<nav class="ledger-tabs"><button>全部</button></nav>';
  const prep=ledger('armory','body',{profile,tabs,inBattle:true,preparation:true});
  expect(prep).toContain('data-action="battle-shop:market"');expect(prep).toContain('本局立即生效');expect(prep.match(/class="ledger-tabs/g)).toHaveLength(1);
  const live=ledger('market','body',{profile,tabs,inBattle:true,preparation:false});
  expect(live).toContain('下局生效');expect(live).not.toContain('battle-shop-banner');
 });
});
