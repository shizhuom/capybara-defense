import {afterEach,describe,expect,it,vi} from 'vitest';
import {assets} from '../src/render/AssetRegistry';
import {createProfile} from '../src/core/MetaProgression';
import {courtyardMarkup} from '../src/ui/CourtyardView';
import {setLanguage,t} from '../src/i18n/i18n';
import * as stickers from '../src/ui/stickers';

afterEach(()=>{vi.restoreAllMocks();setLanguage('zh-CN');});
describe('P4 localized art and menu controls',()=>{
 it.each([['zh-CN','zh'],['en','en']] as const)('uses matching title and Start artwork with semantic accessible labels in %s', (language,suffix)=>{
  setLanguage(language);vi.spyOn(assets,'url').mockImplementation(id=>`./sprites/${id}.png`);
  const html=courtyardMarkup({...createProfile(),stars:5,highestStars:5,matches:5});
  expect(html).toContain(`<h1 class="art-title" aria-label="${t('app.title')}">`);
  for(const id of [`title_logo_${suffix}`,`ui_btn_start_${suffix}`])expect(html).toContain(`src="./sprites/${id}.png"`);
  expect(html).toContain(`data-action="start" aria-label="${t('menu.start')}"`);
  expect(html).toContain('data-sticker="ui_trophy_rank"');expect(html).toContain('data-sticker="ui_map_sign"');
  expect(html).not.toContain('title-plaque');expect(html).not.toContain('logo_capy');
 });
 it.each(['title_logo_zh','title_logo_en','ui_btn_start_zh','ui_btn_start_en'] as const)('keeps %s aspect ratio and escaped accessible text before and after decode',id=>{
  const url=vi.spyOn(assets,'url').mockReturnValue(undefined);
  expect(stickers).toHaveProperty('artSticker');
  const label='<守护> & "Chill"',fallback=stickers.artSticker(id,label);
  expect(fallback).toContain('<svg');expect(fallback).toContain(`data-art-sticker="${id}"`);
  expect(fallback).toContain('aria-label="&lt;守护&gt; &amp; &quot;Chill&quot;"');expect(fallback).not.toContain('<rect');
  expect(fallback).toContain(id.startsWith('title')?'viewBox="0 0 960 320"':'viewBox="0 0 520 220"');
  url.mockReturnValue('./sprites/a.png');const ready=stickers.artSticker(id,label);
  expect(ready).toContain('<img');expect(ready).toContain('draggable="false"');
  expect(ready).toContain('alt="&lt;守护&gt; &amp; &quot;Chill&quot;"');
 });
 it.each(['ui_trophy_rank','ui_map_sign'] as const)('supplies real vector geometry for %s before PNG decode',id=>{
  vi.spyOn(assets,'url').mockReturnValue(undefined);
  const html=stickers.sceneSticker(id,'missing',24);
  expect(html).toContain(`<svg`);expect(html).toContain(`data-sticker="${id}"`);expect(html).not.toContain('missing');
 });
 it('retains all action routes and map unlock state in paired corner medallions',()=>{
  const p={...createProfile(),stars:5,highestStars:5,matches:5,freeLotteryTickets:3};
  const html=courtyardMarkup(p);
  expect(html).toContain('hub-dock-left');expect(html).toContain('hub-dock-right');
  for(const action of ['profile','settings','recipes','armory','market','leaderboard','start','select-map:auto','select-map:sunny_backyard','select-map:sakura_onsen','select-map:midnight_kitchen','select-map:cat_tower_maze'])expect(html).toContain(`data-action="${action}"`);
  expect(html).toContain('ticket-badge');expect(html).toContain('/36');expect(html).toContain('disabled');
 });
});
