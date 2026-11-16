import {it,expect,afterEach} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {createProfile} from '../src/core/MetaProgression';
import {GameApp} from '../src/ui/GameApp';
import {MetaScreens} from '../src/ui/MetaScreens';
import {ProfileScreens,rankCard} from '../src/ui/ProfileScreens';
import {setLanguage,t} from '../src/i18n/i18n';
import {p6Zh,p6En} from '../src/i18n/p6';
afterEach(()=>setLanguage('zh-CN'));
function dialog(kind:'pause'|'result',won=false,withMvp=true){
 const engine=new BattleEngine({autoWaves:false});engine.start();engine.state.sides.player.loot=['m01_swatter','m01_swatter','m10_bamboo_staff'];engine.state.sides.ai.loot=['w12_rain_crown_scepter'];
 if(kind==='result'){engine.surrender();Object.assign(engine.state.result!,{winner:won?'player':'ai',reason:'waves',loot:won?[...engine.state.sides.player.loot]:[],coins:won?65:0,mvp:withMvp?{kind:'kungfu_po',level:3,damage:1234.6,kills:27}:undefined});}
 const app:any=Object.create(GameApp.prototype),node={innerHTML:'',classList:{toggle(){}},setAttribute(){},querySelector(){return null;},insertAdjacentHTML(_where:string,html:string){this.innerHTML+=html;}};
 Object.assign(app,{dialog:node,dialogKind:kind,engine,profile:{...createProfile(),stars:5},savedResult:true,resultStars:won?2:0,previousRank:0,newWeapons:won?['m10_bamboo_staff']:[],newAvatars:won?['sakura_capy']:[]});app.renderDialog();return node.innerHTML;
}
it.each(['zh-CN','en'] as const)('renders a pause ledger with exactly one bare player-loot section and illustrated counts (%s)',lang=>{
 setLanguage(lang);const html=dialog('pause');expect(html).toContain('ledger-shell');expect(html).toContain('ui_pause_peek_capy');expect(html.match(/<section>/g)).toHaveLength(1);
 expect(html).toContain('data-sticker="m01_swatter"');expect(html).toContain(t('weapon.m01_swatter'));expect(html).toContain('×2');expect(html).not.toContain(t('weapon.w12_rain_crown_scepter'));
 for(const action of ['resume','profile','settings','surrender'])expect(html).toContain(`data-action="${action}"`);expect(html).toContain('pause-status-strip');expect(html).not.toMatch(/>p6\.[\w.]+</);
});
it.each(['zh-CN','en'] as const)('renders victory rewards, promotion, MVP and pictured unlocks without raw keys (%s)',lang=>{
 setLanguage(lang);const html=dialog('result',true);for(const cls of ['ledger-shell','result-win-header','visual-report-scroll','visual-mvp-stage','visual-treasure-shelf','settlement-actions'])expect(html).toContain(cls);
 for(const id of ['ui_victory_shield_wings','ui_mvp_crown','ui_stat_damage_burst','ui_stat_ko_skull','ui_coin_gold','ui_ticket_gacha','kungfu_po','m10_bamboo_staff','sakura_capy'])expect(html).toContain(`data-sticker="${id}"`);
 expect(html).toContain('1,235');expect(html).toContain('×27');expect(html).toContain(t('m3.streakBonus'));expect(html).toContain(t('m3.promotion',{rank:t('rank.2')}));
 expect(html).not.toMatch(/>p6\.[\w.]+</);for(const action of ['start','menu'])expect(html).toContain(`data-action="${action}"`);
});
it('uses a warm defeat theme, protected stars and no victory ticket on a loss',()=>{
 const html=dialog('result');expect(html).toContain('result-loss-header');expect(html).toContain('ui_defeat_shield_wings');expect(html).toContain(t('m3.protected'));expect(html).not.toContain('ui_ticket_gacha');
});
it('renders an honest lineup fallback for a zero-damage battle and all P6 keys in both languages',()=>{
 expect(dialog('result',false,false)).toContain(t('p6.noMvp'));
 expect(Object.keys(p6Zh).sort()).toEqual(Object.keys(p6En).sort());
 for(const language of ['zh-CN','en'] as const){setLanguage(language);for(const key of Object.keys(p6Zh))expect(t(key)).not.toBe(key);}
});
it('uses portrait equipment controls without selects and preserves real shop actions',()=>{
 const p={...createProfile(),unlockedWeapons:['m10_bamboo_staff'],equippedWeapons:{kungfu_po:'m10_bamboo_staff'}};
 const meta=new MetaScreens(()=>p,()=>{},()=>{},()=>{}),profile=new ProfileScreens(()=>p,()=>true,()=>{},()=>{});
 meta.action('meta-weapon:m10_bamboo_staff');const html=meta.markup('armory');expect(html).not.toContain('<select');expect(html.match(/data-action="meta-equip:m10_bamboo_staff:/g)).toHaveLength(4);expect(html).toContain('aria-pressed="true"');expect(html).toContain('ui_storybook_check');expect(html).not.toContain('class="text-button" data-action="meta-unequip:');
 const shop=meta.markup('market');expect(shop).toMatch(/class="storybook-shop-heading"[\s\S]*?data-action="meta-refresh"/);
 expect(profile.markup('settings')).not.toContain('settings-language');expect(rankCard(p)).toContain('data-sticker="ui_star_rank"');expect(rankCard(p)).not.toContain('★');
});
