import {afterEach,describe,expect,it} from 'vitest';
import {createProfile} from '../src/core/MetaProgression';
import type {Profile} from '../src/core/types';
import {setLanguage} from '../src/i18n/i18n';
import {ProfileScreens} from '../src/ui/ProfileScreens';

const blocks=(html:string,tag:string,className:string):string[]=>html.match(new RegExp(`<${tag}\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>[\\s\\S]*?</${tag}>`,'g'))??[];
const text=(html:string)=>html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');
const avatarRow=(html:string,id:string)=>blocks(html,'article','avatar-row').find(row=>row.includes(`data-action="avatar:${id}"`))??'';
function screen(initial:Profile=createProfile(),canSave=true) {
  let profile=initial,renders=0;
  const notices:string[]=[];
  const screens=new ProfileScreens(()=>profile,next=>{if(!canSave)return false;profile=next;return true;},()=>{renders++;},key=>notices.push(key));
  return {screens,get profile(){return profile;},get renders(){return renders;},notices};
}
afterEach(()=>setLanguage('zh-CN'));

describe('P11 rank, profile and settings rows',()=>{
  it.each(['zh-CN','en'] as const)('keeps all sixteen places in one uniform rank list with the player highlighted (%s)',language=>{
    setLanguage(language);
    const {screens}=screen({...createProfile(),stars:21});
    const html=screens.markup('leaderboard'),summaries=blocks(html,'section','my-rank-summary-card');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toContain('aria-valuenow="50"');
    expect(text(summaries[0])).toContain('1.52');
    expect(text(summaries[0])).toContain(language==='en'?'Next rank in 1★':'再获 1 颗星');
    expect(text(summaries[0])).toContain(language==='en'?'Cat Cafe Boss I':'猫咖店长 I');
    const lists=blocks(html,'ol','storybook-rank-list');
    expect(lists).toHaveLength(1);
    const rows=blocks(lists[0],'li','leaderboard-row');
    expect(rows).toHaveLength(16);
    for(const [index,row] of rows.entries()){
      expect(row).toContain('storybook-row-card');
      expect(row).toContain(`data-place="${index+1}"`);
      expect(row).toContain('class="storybook-copy"');
      expect(row).toContain('class="portrait-name"');
      expect(row).toContain('class="storybook-tagline"');
      expect(row).toContain('storybook-status');
      expect(text(row)).not.toMatch(/胜率|win rate|matches/);
    }
    expect(rows[0]).toContain('🥇');expect(rows[1]).toContain('🥈');expect(rows[2]).toContain('🥉');
    const player=rows.filter(row=>row.includes('data-player="true"'));
    expect(player).toHaveLength(1);expect(player[0]).toContain('data-place="13"');expect(player[0]).toContain('is-player');
    expect(text(player[0])).toContain(language==='en'?'You are here':'我在这里');
    expect(html).not.toMatch(/rank-podium|podium-card|threat-banner|threat-values/);
  });

  it('caps the top rank progress and still explains current enemy health',()=>{
    setLanguage('en');
    const {screens}=screen({...createProfile(),stars:200});
    const summary=blocks(screens.markup('leaderboard'),'section','my-rank-summary-card')[0]??'';
    expect(summary).toContain('aria-valuenow="100"');
    expect(text(summary)).toContain('Highest rank');
    expect(text(summary)).toContain('6.2');
    expect(text(summary)).not.toMatch(/undefined|NaN|next rank/);
  });

  it.each(['zh-CN','en'] as const)('offers native avatar buttons with current, available and locked states (%s)',language=>{
    setLanguage(language);
    const {screens}=screen({...createProfile(),matches:10,wins:7,bestWinStreak:5,mergedHeroes:['kungfu_po','puss_in_hat']});
    const html=screens.markup('profile'),summary=blocks(html,'section','storybook-profile-summary');
    expect(summary).toHaveLength(1);expect(text(summary[0])).toContain(language==='en'?'10 matches · 70% wins · Best streak 5':'总场次 10 · 胜率 70% · 最高连胜 5');expect(text(summary[0])).toContain('2/12');
    const rows=blocks(html,'article','avatar-row');
    expect(rows).toHaveLength(16);
    for(const row of rows){
      expect(row).toContain('storybook-row-card');expect(row).toContain('<button type="button"');
      expect(row).toContain('class="storybook-row-button"');expect(row).toContain('class="storybook-copy"');
      expect(row).toContain('class="portrait-name"');expect(row).toContain('class="storybook-tagline"');
    }
    const current=avatarRow(html,'capybara'),available=avatarRow(html,'hamster'),locked=avatarRow(html,'zen_capy');
    expect(current).toContain('aria-pressed="true"');expect(current).toContain('data-sticker="ui_storybook_check"');
    expect(current).not.toContain(' disabled');
    expect(available).toContain('aria-pressed="false"');expect(available).not.toContain(' disabled');
    expect(text(available)).toContain(language==='en'?'Change':'更换');
    expect(locked).toContain(' disabled');expect(locked).toContain('data-sticker="ui_lock_closed"');
    expect(locked).not.toContain('data-sticker="ui_storybook_check"');
    expect(html).not.toMatch(/avatar-grid|keeper-stat-grid|passport-layout/);
  });

  it('moves the current avatar check only after an unlocked selection is saved',()=>{
    const state=screen();
    expect(state.screens.action('avatar:hamster')).toBe(true);
    expect(state.profile.avatarId).toBe('hamster');expect(state.renders).toBe(1);expect(state.notices).toEqual(['m3.avatarEquipped']);
    const html=state.screens.markup('profile');
    expect(avatarRow(html,'hamster')).toContain('data-sticker="ui_storybook_check"');
    expect(avatarRow(html,'capybara')).not.toContain('data-sticker="ui_storybook_check"');
    expect(state.screens.action('avatar:zen_capy')).toBe(true);
    expect(state.screens.action('avatar:missing')).toBe(true);
    expect(state.profile.avatarId).toBe('hamster');expect(state.renders).toBe(1);
    const rejected=screen(createProfile(),false);
    rejected.screens.action('avatar:hamster');
    expect(rejected.profile.avatarId).toBe('capybara');expect(rejected.notices).toEqual([]);expect(rejected.renders).toBe(0);
  });

  it.each(['zh-CN','en'] as const)('groups settings into four flat cards while keeping native controls (%s)',language=>{
    setLanguage(language);
    const {screens}=screen(),html=screens.markup('settings'),rows=blocks(html,'article','setting-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('data-setting="musicVolume"');expect(rows[1]).toContain('data-setting="soundVolume"');
    for(const [index,value] of ['50%','75%'].entries()){
      expect(rows[index]).toMatch(/<label\b[\s\S]*<input\b[^>]*type="range"[\s\S]*<output\b[\s\S]*<\/label>/);
      expect(text(rows[index])).toContain(value);
    }
    expect(rows[2].match(/type="checkbox"/g)).toHaveLength(2);
    expect(rows[2]).toMatch(/data-setting="showDamageNumbers"[^>]*checked/);
    expect(rows[2]).toContain('data-setting="developerMode"');
    expect(rows[3]).toContain('data-action="tutorial-replay"');expect(rows[3]).toContain('data-sticker="ui_tutorial_capy"');
    expect(rows[3]).toContain('storybook-frame');
    expect(html).not.toMatch(/wood-slider|toggle-setting-card|tutorial-replay-card|capsule-setting/);
    expect(screens.action('tutorial-replay')).toBe(false);
  });

  it('updates a saved slider output in place and redraws persisted values after a rejected save',()=>{
    const state=screen(),output={textContent:'50%'},fill:Record<string,string>={};
    const input={dataset:{setting:'musicVolume'},value:'0.34',style:{setProperty:(key:string,value:string)=>{fill[key]=value;}},closest:()=>({querySelector:()=>output})} as unknown as HTMLInputElement;
    expect(state.screens.change(input)).toBe(true);
    expect(state.profile.settings.musicVolume).toBe(.34);expect(output.textContent).toBe('34%');expect(fill['--range-fill']).toBe('34%');expect(state.renders).toBe(0);
    const rejected=screen(createProfile(),false);
    output.textContent='50%';fill['--range-fill']='50%';
    expect(rejected.screens.change(input)).toBe(true);
    expect(rejected.profile.settings.musicVolume).toBe(.5);expect(rejected.renders).toBe(1);
    expect(output.textContent).toBe('50%');expect(fill['--range-fill']).toBe('50%');
    const row=blocks(rejected.screens.markup('settings'),'article','setting-row')[0]??'';
    expect(row).toContain('value="0.5"');expect(text(row)).toContain('50%');
  });

  it('persists both toggle values without replacing the other settings',()=>{
    const state=screen();
    for(const [key,checked] of [['showDamageNumbers',false],['developerMode',true]] as const){
      const input={dataset:{setting:key},checked,value:'on',closest:()=>null} as unknown as HTMLInputElement;
      expect(state.screens.change(input)).toBe(true);
    }
    expect(state.profile.settings).toEqual({musicVolume:.5,soundVolume:.75,showDamageNumbers:false,developerMode:true});
  });

  it.each(['zh-CN','en'] as const)('resolves all page text without raw translation keys (%s)',language=>{
    setLanguage(language);const {screens}=screen();
    for(const page of ['leaderboard','profile','settings'] as const){
      const html=screens.markup(page);
      expect(html).not.toMatch(/p11\.profile\.[\w.]+/);
      expect(text(html)).not.toMatch(/(?:p11\.profile|m3|p5|avatar|rank)\.[\w.]+/);
      if(language==='en')expect(text(html)).not.toMatch(/[\u3400-\u9fff]/);
    }
  });
});
