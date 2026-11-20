import {afterEach,expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {createProfile} from '../src/core/MetaProgression';
import {setLanguage,t} from '../src/i18n/i18n';
import {pauseMarkup,resultMarkup,type ResultViewInput} from '../src/ui/SettlementView';

afterEach(()=>setLanguage('zh-CN'));

function resultInput(won=true,oranges=3):ResultViewInput {
 const engine=new BattleEngine({autoWaves:false});engine.start();engine.surrender();
 engine.state.sides.player.oranges=oranges;
 Object.assign(engine.state.result!,{winner:won?'player':'ai',reason:'waves',elapsed:125,coins:won?65:0,loot:won?['m01_swatter','m01_swatter','m10_bamboo_staff']:[],mvp:{kind:'kungfu_po',level:3,damage:1234.6,kills:27}});
 return {state:engine.state,profile:{...createProfile(),stars:5},savedResult:true,resultStars:won?2:0,previousRank:0,newWeapons:won?['m10_bamboo_staff']:[],newAvatars:won?['sakura_capy']:[],newRoster:won?{units:['bee'],heroes:['ronin_goose']}:{units:[],heroes:[]}};
}

it.each([[true,1,1,2],[true,2,2,1],[true,3,3,0],[true,7,3,0],[false,3,0,3],[false,0,0,3]] as const)(
 'lights guardian stars from the surviving oranges, independent of rank reward (win=%s, oranges=%i)',(won,oranges,lit,dim)=>{
  const input=resultInput(won,oranges);input.resultStars=0;
  const html=resultMarkup(input);
  expect(html.match(/data-sticker="ui_victory_star_lit"/g)??[]).toHaveLength(lit);
  expect(html.match(/data-sticker="ui_victory_star_dim"/g)??[]).toHaveLength(dim);
  expect(html).toContain(`data-sticker="ui_${won?'victory':'defeat'}_shield_wings"`);
 });

it('keeps the complete battle report hidden until opened, with working toggle and close contracts',()=>{
 const input=resultInput(),closed=resultMarkup(input),open=resultMarkup({...input,statsOpen:true});
 expect(closed).toMatch(/<aside[^>]*class="crest-stats-drawer"[^>]*hidden/);
 expect(open).toMatch(/<aside[^>]*class="crest-stats-drawer"[^>]*>/);
 expect(open.match(/<aside[^>]*class="crest-stats-drawer"[^>]*>/)?.[0]).not.toContain('hidden');
 expect(closed).toContain('data-action="toggle-result-stats" aria-controls="result-stats" aria-expanded="false"');
 expect(open).toContain('data-action="toggle-result-stats" aria-controls="result-stats" aria-expanded="true"');
 expect(open).toContain('data-action="close-result-stats"');
 for(const html of [closed,open]){
  for(const label of ['1,235','×27','×2',t('m3.streakBonus'),t('m3.promotion',{rank:t('rank.2')}),t('result.awarded')])expect(html).toContain(label);
  for(const id of ['kungfu_po','m10_bamboo_staff','sakura_capy','bee','ronin_goose','ui_mvp_crown','ui_ticket_gacha'])expect(html).toContain(`data-sticker="${id}"`);
 }
});

it('shows bounded progress through the current rank and a full bar at the highest rank',()=>{
 const input=resultInput(),html=resultMarkup(input);
 expect(html).toMatch(/role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="2"[^>]*aria-valuenow="1"/);
 expect(html).toContain('--rank-progress:50%');
 const max=resultMarkup({...input,profile:{...input.profile,stars:190}});
 expect(max).toMatch(/role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="1"[^>]*aria-valuenow="1"/);
 expect(max).toContain('--rank-progress:100%');
});

it('keeps keyboard focus within an open report by making the underlying crest controls inert',()=>{
 const input=resultInput(),closed=resultMarkup(input),open=resultMarkup({...input,statsOpen:true});
 expect(open).toMatch(/class="crest-return-btn"[^>]* inert/);
 expect(open).toMatch(/class="crest-stage"[^>]* inert/);
 expect(open).toMatch(/class="settlement-actions crest-corner-actions"[^>]* inert/);
 expect(closed).not.toContain(' inert');
 expect(open.match(/<aside[^>]*class="crest-stats-drawer"[^>]*>/)?.[0]).not.toContain('inert');
});

it.each(['zh-CN','en'] as const)('renders bilingual corner controls, status, and loss protection without raw keys (%s)',language=>{
 setLanguage(language);
 const won=resultMarkup(resultInput()),loss=resultMarkup(resultInput(false));
 // P15 shortens the corner buttons to one glanceable word each.
 const expected=language==='en'?['VICTORY','Report','Continue','Back to Courtyard']:['守卫成功','战报','继续出征','返回庭院'];
 for(const text of expected)expect(won).toContain(text);
 expect(loss).toContain(language==='en'?'DEFEAT':'澡盆失守');
 expect(loss).toContain(language==='en'?'Try Again':'再来一局');
 expect(loss).toContain(t('m3.protected'));
 expect(loss).not.toContain('ui_ticket_gacha');
 expect(loss).toContain(t('result.reason.waves'));
 expect(won+loss).not.toMatch(/>p12\.[\w.]+</);
});

it('does not award or mutate any progression when the battle report opens repeatedly',()=>{
 const input=resultInput(),before=JSON.stringify(input);
 resultMarkup(input);resultMarkup({...input,statsOpen:true});resultMarkup({...input,statsOpen:false});
 expect(JSON.stringify(input)).toBe(before);
});

it.each(['zh-CN','en'] as const)('renders the towel capy pause with two cards, player-only fragments and all actions (%s)',language=>{
 setLanguage(language);const engine=new BattleEngine({autoWaves:false});engine.start();
 Object.assign(engine.state,{wave:4,time:125});engine.state.sides.player.oranges=2;
 engine.state.sides.player.loot=['m01_swatter','m01_swatter'];engine.state.sides.ai.loot=['w12_rain_crown_scepter'];
 const html=pauseMarkup(engine.state);
 expect(html).toContain('data-sticker="ui_pause_peek_capy"');
 expect(html.match(/<section>/g)).toHaveLength(1);
 expect(html).toContain('pause-storybook-board');expect(html).toContain('pause-status-strip');
 expect(html).toContain('2:05');expect(html).toContain('4/10');expect(html).toContain('×2');
 expect(html).toContain(t('weapon.m01_swatter'));expect(html).not.toContain(t('weapon.w12_rain_crown_scepter'));
 for(const action of ['resume','profile','settings','surrender'])expect(html).toContain(`data-action="${action}"`);
 expect(html).toContain(language==='en'?'Game Paused':'泡汤小憩');
 expect(html).not.toMatch(/>p12\.[\w.]+</);
});

it('uses the gentle boss-drop explanation for an empty paused fragment card',()=>{
 const engine=new BattleEngine({autoWaves:false});engine.start();
 expect(pauseMarkup(engine.state)).toContain('击败首领即可掉落奇葩神兵碎片');
});
