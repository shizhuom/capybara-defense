import { BattleEngine } from '../core/BattleEngine';
import { MergeSystem } from '../core/MergeSystem';
import type { BattleState, CommandResult, Interaction, MapId, Profile, Unit, UnitLocation } from '../core/types';
import { UNITS, BEE_PRODUCTION, ECONOMY, getSummonCost, SHOVEL_PRODUCTION } from '../config/units';
import { HEROES } from '../config/heroes';
import { RECIPES } from '../config/recipes';
import { BOSS_IDS } from '../config/enemies';
import { MAP_IDS, STAGE } from '../config/maps';
import { FIRST_WAVE_PREPARATION, WAVES, WAVE_DURATION } from '../config/waves';
import { StickerRenderer, type HitTarget } from '../render/StickerRenderer';
import { getHeroMergeOptions } from '../core/MergeTargets';
import { waveStrategyMarkup, wavePreviewTip } from './WaveStrategyView';
import { getLanguage, onLanguageChange, setLanguage, t } from '../i18n/i18n';
import { awardBattle, awardEndless, emptyProfile, loadProfile, resetOwnStorage, saveProfile, enableTestProfile, restoreNormalProfile, isTestProfile } from './storage';
import { MetaScreens, propSlots, type MetaScreen } from './MetaScreens';
import { KitchenScreen } from './KitchenScreen';
import { VillageScreen } from './VillageScreen';
import { villageLoadout } from '../core/VillageProgression';
import { MedallionScreen } from './MedallionScreen';
import { EndlessLeaderboardClient, rankSubmissionFromProfile } from './EndlessLeaderboardClient';
import { validateNickname } from '../core/PlayerIdentity';
import { fictionalLocationToken, formatLocation } from '../core/Location';
import { resolveBrowserLocation } from './LocationService';
import { formatCompactNumber } from '../core/formatNumber';
import { AWAKENED_DAMAGE, breakthroughAttackMultiplier, getMedallionLevel, momentumMultiplier } from '../config/medallions';
import { PROPS } from '../config/props';
import { setPropSlots } from '../core/MetaProgression';
import './m2.css';
import './m3.css';
import './p1.css';
import './p3-components.css';
import './p3.css';
import './p5.css';
import './p6.css';
import {lootMarkup as illustratedLoot, pauseMarkup, resultMarkup, endlessOfferMarkup} from './SettlementView';
import {earlyWaveCoachmarkMarkup,nextBattleSpeed,passiveRailMarkup,p13WaveMarkup} from './P13HUD';
import {propTargetKind,resolvePropDrop} from '../core/PropTargets';
import { liveUnitCardMarkup, momentumText, breakthroughBreakdown } from './LiveUnitCard';
import { getBeeProduction } from '../core/UnitStats';
import { courtyardMarkup } from './CourtyardView';
import { RANKS, getRank } from '../config/ranks';
import { recordMergedHeroes, resolveMap, pickBattleMap, updateSettings, selectMap } from '../core/PlayerProgression';
import {newlyUnlocked} from '../config/progression';
import {bindAudioGestures} from './AudioGestures';
import {transitionMarkup,enemyAlertMarkup} from './BattlePresentation';
import { ProfileScreens, type ProfileScreen } from './ProfileScreens';
import { SoundManager } from './SoundManager';
import { capyLogo, escapeHtml as esc } from './art';
import { onAssetsReady } from '../render/AssetRegistry';
import { propSticker, sceneSticker, unitSticker, P9_SCENE_IDS, P10_SCENE_IDS, P11_SCENE_IDS, P12_SCENE_IDS, P13_SCENE_IDS, P14_SCENE_IDS, P15_SCENE_IDS, P16_SCENE_IDS, P17_SCENE_IDS } from './stickers';
import { Compendium } from './Compendium';
import { getBossHUD, getWaveHUD, getMusicMode, isDeveloperMode } from './BattleHUD';
import { advanceTutorial, finishTutorial, replayTutorial, type TutorialAction, type TutorialStep } from '../core/Tutorial';
import { tutorialMarkup, tutorialTargets, placeTutorialBubble, tutorialCardDock, type TutorialRect } from './TutorialView';

type Hit = HitTarget;
type DialogKind = 'pause' | 'recipes' | 'result' | 'endless-offer' | 'kitchen' | 'village' | 'medallions' | MetaScreen | ProfileScreen;
/** Overlays that share one return point: the profile ledger tabs and the P17 medallion hall. */
type OverlayScreen = ProfileScreen | 'medallions';
type Drag = { pointerId: number; start: { x: number; y: number }; point: { x: number; y: number }; id?: number; shovel: boolean; moved: boolean };
const tr = (key: string, vars?: Record<string, string | number>) => esc(t(key, vars));
const unitName = (kind: string) => t(`${HEROES[kind] ? 'hero' : 'unit'}.${kind}`);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const icon = (kind: string) => `<span aria-hidden="true" class="pet-icon">${unitSticker(kind,40)}</span>`;

export class GameApp {
  engine: BattleEngine | null = null;
  profile = loadProfile();
  private canvas: HTMLCanvasElement;
  private renderer: StickerRenderer;
  private dialog: HTMLDialogElement;
  private dialogKind: DialogKind | null = null;
  private modalReturn: { dialog: DialogKind | null; resume: boolean } | null = null;
  private liveStamp = '';
  private waveStrategyStamp = '';
  private rotateDismissed = false;
  private tutorialPointerAction?: string;
  private ledgerStamp='';
  private resultStatsOpen=false;
  private speed: 1 | 2 | 3 = 1;
  private earlyTipStamp='';
  private passiveStamp='';
  private passiveInfoId?:string;
  private selectedId?: number;
  private mergeLocatorHero?: string;
  private shovelSelected = false;
  private selectedProp?: string;
  private propDrag?: { pointerId: number; startX: number; startY: number; moved: boolean; id: string; point?: { x: number; y: number } };
  private suppressPropClick = false;
  private newWeapons: string[] = [];
  private meta: MetaScreens;
  private profileScreens: ProfileScreens;
  private kitchen: KitchenScreen;
  private village: VillageScreen;
  private medallions: MedallionScreen;
  /** P17 global leaderboards (endless + rank): shared client, loading flags, nickname draft, location prompt and hub lock. */
  private board = new EndlessLeaderboardClient();
  private boardLoading = false;
  private rankBoardLoading = false;
  private locating = false;
  private boardDraft?: string;
  private endlessHubMode = false;
  private globalRank?: number;
  private p17EventId = 0;
  private sound = new SoundManager(this.profile.settings);
  private compendium = new Compendium();
  private tutorialStep: TutorialStep = 'done';
  private tutorialStamp = '';
  private bossStamp = '';
  private assetsDirty = false;
  private transitionUntil=0;
  private newRoster:{units:string[];heroes:string[]}={units:[],heroes:[]};
  private alertSeen=new Set<number>();
  private alertQueue:BattleState['events']=[];
  private activeAlert?:{event:BattleState['events'][number];until:number};
  private devMapOverride?: MapId;
  private retainedPage = false;
  private overlayReturn: { dialog: DialogKind | null; resume: boolean } | null = null;
  private newAvatars: string[] = [];
  private resultStars = 0;
  private previousRank = 0;
  private mergedStamp = '';
  private quickStamp = '';
  private battlePropsStamp = '';
  private drag?: Drag;
  private completedId = '';
  private savedResult = true;
  private lastFrame = performance.now();
  private lastRefresh = 0;
  private inspectorStamp = '';
  private keyboardStamp = '';
  private toast?: { key: string; vars: Record<string, string | number>; error: boolean; until: number };

  constructor(private root: HTMLElement) {
    this.meta = new MetaScreens(() => this.profile, profile => {
      this.acceptPersistedProfile(profile);
    }, () => { if (this.dialogKind === 'armory' || this.dialogKind === 'market') this.renderDialog(); }, (key, error, vars) => this.notify(key, error, vars), cue => this.sound.play(cue));
    this.kitchen = new KitchenScreen(() => this.profile, profile => this.acceptPersistedProfile(profile),
      () => { if (this.dialogKind === 'kitchen') this.renderDialog(); }, (key, error, vars) => this.notify(key, error, vars), cue => this.sound.play(cue));
    this.village = new VillageScreen(() => this.profile, profile => this.acceptPersistedProfile(profile),
      () => { if (this.dialogKind === 'village') this.renderDialog(); }, (key, error, vars) => this.notify(key, error, vars), cue => this.sound.play(cue));
    this.medallions = new MedallionScreen(() => this.profile, profile => this.acceptPersistedProfile(profile),
      () => { if (this.dialogKind === 'medallions') this.renderDialog(); }, (key, error, vars) => this.notify(key, error, vars), cue => this.sound.play(cue));
    this.profileScreens = new ProfileScreens(() => this.profile, profile => this.persistProfile(profile), () => this.refresh(true), key => this.notify(key),
      () => ({ snapshot: this.board.snapshot(), loading: this.boardLoading, nicknameDraft: this.boardDraft, endlessHub: this.endlessHubMode, locating: this.locating }),
      () => { this.syncAllBoards(); },
      () => ({ snapshot: this.board.rankSnapshot(), loading: this.rankBoardLoading, locating: this.locating }));
    this.root.innerHTML = this.shell();
    this.canvas = this.element<HTMLCanvasElement>('battle-canvas');
    this.dialog = this.element<HTMLDialogElement>('game-dialog');
    this.renderer = new StickerRenderer(this.canvas);
    this.bindEvents();
    onLanguageChange(() => this.refresh(true));
    onAssetsReady(() => { this.assetsDirty = true; });
    this.element<HTMLDetailsElement>('dev-tools').open = false;

    this.refresh(true);
    requestAnimationFrame(this.frame);
  }

  private element<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.root.querySelector<T>(`#${id}`)!;
  }

  private shell(): string {
    return `<div class="page-shell">
      <header class="masthead">
        <a class="brand" href="#" data-action="brand" aria-label="${tr('app.title')}"><span class="brand-mark">${sceneSticker('logo_capy',capyLogo,54)}</span><span><strong data-i18n="app.title"></strong><small data-i18n="app.subtitle"></small></span></a>
        <div class="header-actions"><span class="edition" data-i18n="app.edition"></span><button type="button" class="icon-button settings-button" data-action="settings" data-label="m3.settings">⚙</button><div class="language-switch" role="group" data-label="app.language"><button type="button" data-action="zh-CN">中</button><button type="button" data-action="en">EN</button></div></div>
      </header>
      <main class="game-layout">
        <aside class="sandbox-column">
          <details id="dev-tools" class="paper-card dev-panel" open>
            <summary><span class="eyebrow" data-i18n="dev.tag"></span><span class="dev-heading"><span aria-hidden="true">✳</span> <span data-i18n="dev.title"></span><span class="collapse-chevron" aria-hidden="true">⌄</span></span></summary>
            <div class="dev-content"><p class="muted" data-i18n="dev.subtitle"></p><div class="live-strip"><i></i><span id="dev-state"></span><b id="dev-wave"></b></div>
              <button type="button" class="button food-button" data-action="food" data-battle><span aria-hidden="true">🥫</span><span data-i18n="dev.addFood"></span></button>
              <p class="control-caption" data-i18n="dev.addFoodNote"></p>
              <div class="control-group"><label for="dev-unit" data-i18n="dev.unitLabel"></label><select id="dev-unit" data-battle></select><button type="button" class="button button-light" data-action="grant" data-battle data-i18n="dev.grant"></button></div>
              <div class="control-group"><label for="dev-boss" data-i18n="dev.bossLabel"></label><select id="dev-boss" data-battle></select><button type="button" class="button button-peach" data-action="boss" data-battle data-i18n="dev.boss"></button><p class="control-caption" data-i18n="dev.bossNote"></p></div>
              <div class="control-group"><span class="field-label" data-i18n="dev.oranges"></span><div class="button-row"><button type="button" class="button button-light" data-action="orange-minus" data-battle data-i18n="dev.orangeRemove"></button><button type="button" class="button button-light" data-action="orange-plus" data-battle data-i18n="dev.orangeAdd"></button></div></div>
              <button type="button" class="button button-light" data-action="skip" data-battle><span aria-hidden="true">↠</span> <span data-i18n="dev.skip"></span></button>
              <div class="speed-control"><span data-i18n="dev.speed"></span><div class="segmented"><button type="button" data-action="speed-1" data-battle>1×</button><button type="button" data-action="speed-2" data-battle>2×</button><button type="button" data-action="speed-3" data-battle>3×</button></div></div>
              <div class="dev-live" id="dev-live"></div><p class="control-caption" id="dev-tip"></p>
              <section class="m2-dev"><strong id="profile-mode"></strong><button type="button" class="button button-peach" data-action="test-enable" data-i18n="m2.testEnable"></button><button type="button" class="button button-light" data-action="test-restore" data-i18n="m2.testRestore"></button><label for="dev-rank" data-i18n="m3.devRank"></label><select id="dev-rank"></select><label for="dev-map" data-i18n="m3.devMap"></label><select id="dev-map"></select><p data-i18n="m2.nextBattle"></p><div id="quick-loadout"></div></section>
              <details class="paper-card keyboard-card"><summary data-i18n="keyboard.title"></summary><p class="muted" data-i18n="keyboard.help"></p><div id="keyboard-controls"></div></details><div class="reset-control"><button type="button" class="text-button" data-action="reset" data-i18n="dev.reset"></button><p class="control-caption" data-i18n="dev.resetNote"></p></div>
            </div>
          </details>
          <div class="side-note"><span aria-hidden="true">✿</span><p data-i18n="guide.survival"></p></div>
        </aside>
        <section class="center-column">
          <div class="stage menu-mode" id="stage">
            <canvas id="battle-canvas" width="${STAGE.width}" height="${STAGE.height}" tabindex="0" role="img"></canvas>
            <section class="menu-screen" id="menu-screen"></section>
            <div class="battle-hud" id="battle-hud" hidden>
              <div class="resource-dock"><div class="wave-pill"><strong id="hud-wave"></strong><div id="wave-progress" class="wave-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i><span></span></div></div><div id="wave-strategy" class="wave-strategy"></div><div class="food-pill"><span aria-hidden="true">${sceneSticker('ui_fish_food','',34)}</span><strong id="food-value"></strong></div><div class="orange-pill"><span aria-hidden="true">${sceneSticker('orange','',30)}</span><strong id="orange-value"></strong></div><span class="time-chip" id="battle-clock" hidden></span></div>
              <div class="control-dock"><button type="button" class="guide-button" data-action="recipes"><span aria-hidden="true">${sceneSticker('ui_compendium_book','',34)}</span><span data-i18n="p3.guide"></span></button><button type="button" data-action="battle-shop"><span aria-hidden="true">${sceneSticker('ui_shop_bag','',34)}</span><span data-i18n="p3.shop"></span></button><button type="button" class="speed-pill" data-action="speed" data-label="hud.speedLabel" id="hud-speed">1×</button><button type="button" data-action="pause" data-label="hud.pause" id="pause-button">Ⅱ</button></div>
            </div>
            <div id="boss-banner" class="boss-banner" hidden></div>
            <div id="enemy-alert-banner" role="status" aria-live="polite" hidden></div>
            <button type="button" id="battle-transition" data-action="skip-transition" hidden></button>
            <div class="battle-actions" id="battle-actions" hidden><button type="button" class="redraw-hero-badge" id="redraw-hero-badge" data-action="focus-hero-merge" hidden></button><button type="button" class="summon-button" data-action="summon" id="summon-button"><span aria-hidden="true" class="bell">${sceneSticker('ui_bell_summon','',46)}</span><span aria-hidden="true">${sceneSticker('ui_fish_food','',28)}</span><strong id="summon-cost">10</strong><b class="refresh-badge" id="summon-refresh-count" aria-hidden="true">↻5</b></button></div>
            <div id="live-card-host"></div>
            <div id="battle-props" hidden></div><div id="sealed-hint" class="sealed-hint" hidden></div>
            <div id="tutorial-overlay" hidden></div>
            <div id="early-wave-coachmark" hidden></div>
            <aside id="passive-rail" hidden></aside>
          </div>
          <div id="rotate-hint" class="rotate-hint"><span data-i18n="p3.rotate"></span><button type="button" data-action="fullscreen" id="fullscreen-button" data-i18n="p3.fullscreen"></button><button type="button" data-action="dismiss-rotate" data-label="m2.close">×</button></div><p class="stage-caption" data-i18n="guide.controls"></p>
        </section>
        <aside class="journal-column">
          <section class="paper-card guide-card"><span class="eyebrow" data-i18n="menu.new"></span><h2 data-i18n="guide.title"></h2><ol class="how-to"><li><b>01</b><div><h3 data-i18n="guide.step1"></h3><p data-i18n="guide.step1Body"></p></div></li><li><b>02</b><div><h3 data-i18n="guide.step2"></h3><p data-i18n="guide.step2Body"></p></div></li><li><b>03</b><div><h3 data-i18n="guide.step3"></h3><p data-i18n="guide.step3Body"></p></div></li></ol><div class="tiny-recipe"><span>🐼</span><b>+</b><span>🎋</span><b>=</b><span class="legend-sticker">🐼<i>✦</i></span></div><button type="button" class="text-button recipe-link" data-action="recipes" data-i18n="recipe.open"></button></section>
          <section class="paper-card inspect-card"><h2 data-i18n="inspect.title"></h2><div id="inspector"></div></section>
          <div class="tip-note"><span aria-hidden="true">☂</span><p data-i18n="guide.tip"></p></div>

        </aside>
      </main>
      <footer class="page-footer"><span aria-hidden="true">✿</span> <span data-i18n="app.footer"></span></footer>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
      <dialog id="game-dialog" class="game-dialog"></dialog>
    </div>`;
  }

  /** Direct calls remain synchronous for headless logic tests; UI starts use the curtain. */
  start(withTransition=false): void {
    if(this.engine?.state.phase==='finished'&&this.savedResult===false){this.notify('p13.saveFirst',true);return;}
    this.resultStatsOpen=false;
    this.endTransition();
    this.closeDialog(false);
    this.overlayReturn = null; this.modalReturn = null;
    const guided=!this.profile.tutorialCompleted,bestStars=Math.max(this.profile.stars,this.profile.highestStars);
    this.engine = new BattleEngine({ tutorialGuided:guided, progressionStars:isTestProfile()?undefined:bestStars,progressionHeroes:this.profile.mergedHeroes, mapId: this.devMapOverride ?? (guided?'sunny_backyard':pickBattleMap(this.profile).id), rankIndex: getRank(this.profile.stars).index, loadouts: { player: structuredClone(villageLoadout(this.profile)) } });
    this.engine.start();
    this.tutorialStep = this.profile.tutorialCompleted ? 'done' : 1;
    this.engine.setTutorialHold(this.tutorialStep!=='done');
    this.tutorialStamp = ''; this.bossStamp = '';
    this.speed = 1;
    this.completedId = '';
    this.savedResult=true;this.resultStars=0;this.passiveInfoId=undefined;this.earlyTipStamp='';this.passiveStamp='';
    this.newWeapons = []; this.globalRank = undefined;
    this.newAvatars = []; this.mergedStamp = '';
    this.newRoster={units:[],heroes:[]};this.alertSeen=new Set();this.alertQueue=[];this.activeAlert=undefined;
    this.element('enemy-alert-banner').hidden=true;
    this.battlePropsStamp = '';
    this.clearSelection();
    this.lastFrame = performance.now();
    this.refresh(true);
    this.canvas.focus({ preventScroll: true });
    if(withTransition){
      const curtain=this.element('battle-transition'),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
      this.transitionUntil=performance.now()+(reduced?250:1250);this.engine.setTransitionHold(true);
      this.sound.setMusicPaused?.(true);this.sound.play('battle_start_clash');
      curtain.innerHTML=transitionMarkup(this.engine.state,isTestProfile()?20:bestStars);curtain.hidden=false;curtain.classList.toggle('reduced-motion',reduced);
      curtain.focus({preventScroll:true});
    }
  }
  private endTransition():void {
    if(!this.transitionUntil)return;
    this.transitionUntil=0;this.engine?.setTransitionHold(false);this.sound.setMusicPaused?.(false);
    this.element('battle-transition').hidden=true;
    if(!this.dialog?.open)this.canvas.focus({preventScroll:true});
  }
  private renderEnemyAlerts(now:number):void {
    const state=this.engine?.state;if(!state)return;
    for(const event of state.events)if(event.enemyKind&&(event.effect==='elite_spawn'||event.effect==='boss_spawn')&&!this.alertSeen.has(event.id)){
      this.alertSeen.add(event.id);
      if(event.boss&&!this.activeAlert?.event.boss){
        if(this.activeAlert)this.alertQueue.unshift(this.activeAlert.event);
        this.alertQueue.unshift(event);this.activeAlert=undefined;
      }else this.alertQueue.push(event);
    }
    if(this.activeAlert&&now>=this.activeAlert.until)this.activeAlert=undefined;
    if(!this.activeAlert&&this.alertQueue.length)this.activeAlert={event:this.alertQueue.shift()!,until:now+2600};
    const el=this.element('enemy-alert-banner');el.hidden=!this.activeAlert||state.phase==='finished';
    if(this.activeAlert){
      const event=this.activeAlert.event;el.classList.toggle('boss-entry',!!event.boss);const html=enemyAlertMarkup(event);if(el.innerHTML!==html)el.innerHTML=html;
      el.style.left='';el.style.width='';
      const card=this.element('live-unit-card'),bounds=this.canvas.getBoundingClientRect();
      if(card&&!card.hidden&&bounds.width){
        const r=card.getBoundingClientRect(),a=el.getBoundingClientRect();
        if(r.bottom>a.top&&r.top<a.bottom){
          const intervals=[[bounds.left+12,Math.min(bounds.right-12,r.left-10)],[Math.max(bounds.left+12,r.right+10),bounds.right-12]];
          const [left,right]=intervals.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0],width=Math.min(bounds.width*.52,Math.max(0,right-left));
          if(width>160){el.style.left=`${((left+(right-left-width)/2-bounds.left)/bounds.width)*100}%`;el.style.width=`${width/bounds.width*100}%`;}
        }
      }
    }
  }

  private menu(): void {
    if(this.engine?.state.phase==='finished'&&this.savedResult===false){this.notify('p13.saveFirst',true);return;}
    this.resultStatsOpen=false;
    this.endTransition();this.activeAlert=undefined;this.alertQueue=[];this.element('enemy-alert-banner').hidden=true;
    this.closeDialog(false);
    this.overlayReturn = null;
    this.engine = null;
    this.tutorialStep = 'done'; this.tutorialStamp = '';
    this.clearSelection();
    this.refresh(true);
    this.root.querySelector<HTMLButtonElement>('[data-action="start"]')?.focus({ preventScroll: true });
  }

  private frame = (now: number): void => {
    if(this.transitionUntil&&now>=this.transitionUntil)this.endTransition();
    const dt = Math.min(Math.max((now - this.lastFrame) / 1000, 0), 0.06);
    this.lastFrame = now;
    if (this.engine) {
      this.engine.tick(dt * this.speed);
      const state = this.engine.state;
      if(!this.transitionUntil)this.sound.setMode(getMusicMode(state,!!this.dialogKind));
      this.renderEnemyAlerts(now);
      this.sound.consumeBattle(state);
      this.observeP17Events(state);
      this.sound.setDucked(this.retainedPage || document.hidden || state.phase !== 'playing');
      const merged = state.mergedHeroes.player;
      const mergedStamp = merged.join(',');
      if (mergedStamp !== this.mergedStamp) {
        this.mergedStamp = mergedStamp;
        const next = recordMergedHeroes(this.profile, merged);
        if (JSON.stringify(next) !== JSON.stringify(this.profile)) this.persistProfile(next);
      }
      if (this.selectedId && !state.units.some(unit => unit.id === this.selectedId && unit.side === 'player')) this.selectedId = undefined;
      if (state.phase === 'finished' && this.completedId !== this.settlementKey(state)) this.finish(state);
      const interaction: Interaction = { selectedId: this.selectedId, shovel: this.shovelSelected, propId: this.selectedProp, showDamageNumbers: this.profile.settings.showDamageNumbers,allowBenchLock:this.tutorialStep==='done' };
      if(this.drag?.id&&!this.selectedProp&&!this.shovelSelected)interaction.previewSourceId=this.drag.id;
      if(state.endless){
        const chances:Record<number,number>={};
        for(const unit of state.units)if(unit.side==='player'&&HEROES[unit.kind]&&unit.level>=5&&!unit.awakened)chances[unit.id]=this.engine.getBreakthroughChance(unit).total;
        interaction.breakthroughChances=chances;
      }
      if (this.drag?.moved) {
        interaction.draggingId = this.drag.id;
        interaction.pointer = this.drag.point;
        interaction.shovel = this.drag.shovel;
        const hit = this.renderer.hitTest(this.drag.point.x, this.drag.point.y);
        if (hit?.kind === 'cell') interaction.hover = { col: hit.col, row: hit.row };
      }
      if (this.propDrag?.moved && this.propDrag.point) {
        interaction.pointer = this.propDrag.point;
        const hit = this.renderer.hitTest(interaction.pointer.x, interaction.pointer.y);
        if (hit?.kind === 'cell') interaction.hover = { col: hit.col, row: hit.row };
      }
      if(!interaction.shovel&&!interaction.propId&&state.units.length>1){
        const bounds=this.canvas.getBoundingClientRect();
        if(bounds.width&&bounds.height)interaction.mergeAvoidRects=[...this.root.querySelectorAll<HTMLElement>('.resource-dock,.control-dock,.wave-progress>span,#boss-banner,#live-unit-card,#redraw-hero-badge,#enemy-alert-banner')].flatMap(element=>{
          if(element.hidden)return[];const r=element.getBoundingClientRect();
          return r.width&&r.height?[{x:(r.left-bounds.left)/bounds.width*STAGE.width,y:(r.top-bounds.top)/bounds.height*STAGE.height,w:r.width/bounds.width*STAGE.width,h:r.height/bounds.height*STAGE.height}]:[];
        });
      }
      this.renderer.draw(state, state.time, interaction);
    } else { this.renderer.drawPreview(this.devMapOverride ?? resolveMap(this.profile), now / 1000, ECONOMY.initialOranges + (this.profile.equippedPassiveProps.includes('extra_oranges') ? 2 : 0) + (this.profile.equippedPassiveProps.includes('shared_oranges') ? 4 : 0)); this.sound.setMode('menu'); this.sound.setDucked(this.retainedPage || document.hidden); }
    if (now - this.lastRefresh > 120) { this.refresh(); this.lastRefresh = now; if (this.dialogKind === 'village' && this.village.stale()) this.renderDialog(); }
    requestAnimationFrame(this.frame);
  };

  private settlementKey(state:BattleState):string {return state.endless?`${state.id}:endless`:state.id;}

  /** Only adopt a reward candidate after its receipt and inventory are persisted together. */
  private persistResult(state:BattleState):void {
    if (state.result) {
      const before = this.profile;
      if(!state.endless&&!before.awardedBattles.includes(state.id))this.previousRank = getRank(before.stars).index;
      const award = state.endless?awardEndless(this.profile,state.id,state.result):awardBattle(this.profile, state.id, state.result);
      const receipt=this.settlementKey(state);
      this.savedResult = award.awarded?saveProfile(award.profile):award.profile.awardedBattles.includes(receipt);
      if (this.savedResult) {
        this.profile = award.profile;
        if(award.awarded){
          this.newWeapons = [...new Set([...(state.endless?this.newWeapons:[]),...award.newWeapons])];
          if(!state.endless){
            this.newRoster=state.result.winner==='player'?newlyUnlocked(Math.max(before.stars,before.highestStars),Math.max(this.profile.stars,this.profile.highestStars)):{units:[],heroes:[]};
            this.resultStars = this.profile.stars - before.stars;
            if(this.newRoster.heroes.length)this.sound.play('hero_merge');
          }
          this.newAvatars = [...new Set([...(state.endless?this.newAvatars:[]),...this.profile.unlockedAvatars.filter(id => !before.unlockedAvatars.includes(id))])];
          if(state.endless)this.syncEndlessScore();
          else this.syncRankScore();
        }
      }
    }
  }

  private finish(state: BattleState): void {
    this.completedId = this.settlementKey(state);
    this.clearSelection();
    this.persistResult(state);
    if(state.result)this.sound.play(state.result.winner === 'player' ? 'victory' : 'defeat');
    const offer=!state.endless&&state.wave===10&&state.result?.winner==='player'&&state.result.reason==='waves';
    this.showDialog(offer?'endless-offer':'result');
    this.refresh(true);
  }

  /** P17 cues reuse existing sounds only: the bubble shield pops with `orange_gain`, Calm Ward clanks with `hit_heavy`. */
  private observeP17Events(state: BattleState): void {
    for (const event of state.events) {
      if (event.id <= this.p17EventId) continue;
      this.p17EventId = event.id;
      if (event.type === 'shield_block') this.sound.play('orange_gain');
      else if (event.type === 'bubble' && event.effect === 'resist_block') this.sound.play('hit_heavy');
    }
  }
  /** Background upload after an endless receipt is saved; the result plaque shows the rank once it arrives. */
  private syncEndlessScore(): void {
    const profile = this.profile, board = this.board;
    if (!board || isTestProfile()) return;
    void board.submitScore(profile, getLanguage()).then(outcome => {
      if (!outcome.ok || !outcome.rank) return;
      this.globalRank = outcome.rank;
      if (this.dialogKind === 'result' || this.dialogKind === 'endless-board') this.renderDialog();
    });
  }
  /** Background upload of real rank stars/wins/matches to the global Rank Board. */
  private syncRankScore(force = false): void {
    const profile = this.profile, board = this.board;
    if (!board || !board.configured || isTestProfile() || profile.rankTainted) return;
    const payload = rankSubmissionFromProfile(profile, getLanguage());
    if (!payload) return;
    const me = board.rankSnapshot().me;
    if (!force && me && me.stars === payload.stars && me.matches === payload.matches && me.wins === payload.wins
      && me.nickname === payload.nickname && me.avatarId === payload.avatarId && (me.location ?? '') === payload.location) {
      return;
    }
    void board.submitRank(profile, getLanguage()).then(outcome => {
      if (!outcome.ok) return;
      if (this.dialogKind === 'leaderboard') {
        void board.refreshRank(this.profile.playerId, true).then(() => {
          if (this.dialogKind === 'leaderboard') this.renderDialog();
        });
      }
    });
  }
  private syncAllBoards(): void {
    if (!this.board.configured || isTestProfile()) return;
    if ((this.profile.bestEndlessWave ?? 0) >= 11) this.syncEndlessScore();
    this.syncRankScore();
  }
  /** Loads the Endless Top 100 (30 s cache unless forced); never throws, and offline keeps the cached board. */
  private refreshBoard(force = false): void {
    if (this.boardLoading) return;
    if (!this.board.configured) { if (this.dialogKind === 'endless-board') this.renderDialog(); return; }
    if (!force && this.board.fresh()) return;
    this.boardLoading = true; if (this.dialogKind === 'endless-board') this.renderDialog();
    void this.board.refresh(this.profile.playerId, force).then(snapshot => {
      this.boardLoading = false;
      void snapshot;
      if (this.dialogKind === 'endless-board') this.renderDialog();
    });
  }
  /** Loads the Global Rank Top 100 (30 s cache unless forced); never throws, and offline keeps the cached board. */
  private refreshRankBoard(force = false): void {
    if (this.rankBoardLoading) return;
    if (!this.board.configured) { if (this.dialogKind === 'leaderboard') this.renderDialog(); return; }
    if (!force && this.board.rankFresh()) return;
    this.rankBoardLoading = true; if (this.dialogKind === 'leaderboard') this.renderDialog();
    void this.board.refreshRank(this.profile.playerId, force).then(snapshot => {
      this.rankBoardLoading = false;
      void snapshot;
      if (this.dialogKind === 'leaderboard') this.renderDialog();
    });
  }
  /** Requests browser geolocation permission, falling back to a cute fictional location on denial/failure. */
  private async requestLocation(auto = false): Promise<void> {
    if (this.locating) return;
    this.locating = true;
    if (this.dialogKind === 'leaderboard' || this.dialogKind === 'endless-board') this.renderDialog();
    const language = getLanguage();
    const result = await resolveBrowserLocation({
      language,
      playerId: this.profile.playerId,
      fallbackGeo: this.board.configured ? () => this.board.fetchGeoLocation() : undefined,
    });
    this.locating = false;
    const next: Profile = { ...this.profile, locationMode: result.mode, locationLabel: result.label };
    if (this.persistProfile(next)) {
      const place = formatLocation(result.label, language, next.playerId);
      if (result.ok) this.notify('p17.location.detected', false, { place });
      else if (!auto || result.reason === 'denied') this.notify('p17.location.denied', false, { place });
      this.syncAllBoards();
      if (this.dialogKind === 'endless-board') this.refreshBoard(true);
      else if (this.dialogKind === 'leaderboard') this.refreshRankBoard(true);
      else if (this.dialogKind === 'profile') this.renderDialog();
    } else if (this.dialogKind === 'leaderboard' || this.dialogKind === 'endless-board') {
      this.renderDialog();
    }
  }
  /** Turns location sharing off and reverts to the player's default cute fictional Onsen spot. */
  private disableLocation(): void {
    const language = getLanguage();
    const token = fictionalLocationToken(this.profile.playerId);
    const next: Profile = { ...this.profile, locationMode: 'fictional', locationLabel: token };
    if (!this.persistProfile(next)) return;
    this.notify('p17.location.turnedOff', false, { place: formatLocation(token, language, next.playerId) });
    this.syncAllBoards();
    if (this.dialogKind === 'endless-board') this.refreshBoard(true);
    else if (this.dialogKind === 'leaderboard') this.refreshRankBoard(true);
    else if (this.dialogKind === 'profile') this.renderDialog();
  }
  /** Validates and saves the nickname; strictly rejects duplicate names across BOTH global boards without losing the draft. */
  private async saveNickname(): Promise<void> {
    const input = this.dialog.querySelector<HTMLInputElement>('[data-endless-nickname]');
    const check = validateNickname(input?.value ?? this.boardDraft ?? '');
    if (!check.ok) { this.notify(check.key, true); return; }
    const candidate: Profile = { ...this.profile, nickname: check.value };
    const language = getLanguage();
    if (this.board.configured && !isTestProfile()) {
      const hasEndless = (this.profile.bestEndlessWave ?? 0) >= 11;
      const hasRank = !!rankSubmissionFromProfile(candidate, language);
      if (hasEndless || hasRank) {
        const outcome = hasEndless
          ? await this.board.submitScore(candidate, language)
          : await this.board.submitRank(candidate, language);
        if (outcome.ok) {
          if (!this.persistProfile(candidate)) return;
          if (hasEndless && hasRank) void this.board.submitRank(candidate, language);
          this.boardDraft = undefined; this.notify('p17.board.synced');
          if (this.dialogKind === 'endless-board') this.refreshBoard(true);
          else if (this.dialogKind === 'leaderboard') this.refreshRankBoard(true);
          else this.renderDialog();
          return;
        }
        if (outcome.mode === 'offline') {
          if (!this.persistProfile(candidate)) return;
          this.boardDraft = undefined; this.notify('p17.nameSavedOffline'); this.renderDialog();
          return;
        }
        this.boardDraft = check.value; this.notify(outcome.key, true); this.renderDialog();
        return;
      }
      const availability = await this.board.checkNickname(check.value, this.profile.playerId);
      if (!availability.available) {
        this.boardDraft = check.value; this.notify(availability.key ?? 'p17.nameTaken', true); this.renderDialog();
        return;
      }
      if (!this.persistProfile(candidate)) return;
      this.boardDraft = undefined; this.notify(availability.mode === 'offline' ? 'p17.nameSavedOffline' : 'p17.nameSaved'); this.renderDialog();
      return;
    }
    if (!this.persistProfile(candidate)) return;
    this.boardDraft = undefined; this.notify('p17.nameSaved'); this.renderDialog();
  }

  private refresh(force = false): void {
    const state = this.engine?.state;
    const active = state?.phase === 'playing';
    if(this.assetsDirty && !this.drag && !this.propDrag) {
      this.assetsDirty=false; force=true;
      this.quickStamp=''; this.battlePropsStamp=''; this.bossStamp='';this.tutorialStamp='';this.waveStrategyStamp='';this.liveStamp='';this.earlyTipStamp='';this.passiveStamp='';
      this.root.querySelector('.brand-mark')!.innerHTML=sceneSticker('logo_capy',capyLogo,54);
      const ids=['ui_fish_food','ui_bell_summon','ui_compendium_book','ui_shop_bag','orange','ui_trophy_rank','ui_map_sign','ui_header_compendium','ui_header_armory','ui_header_market','ui_header_rank','ui_header_profile','ui_header_settings','ui_tutorial_pointer','ui_tutorial_capy','ui_coin_gold','ui_star_rank','ui_ticket_gacha','ui_skull_threat','ui_result_victory','ui_result_defeat','ui_header_pause','ui_mvp_crown','ui_lock_closed','ui_lock_open','ui_wave_horn','ui_merge_sparkle',...P9_SCENE_IDS,...P10_SCENE_IDS,...P11_SCENE_IDS,...P12_SCENE_IDS,...P13_SCENE_IDS,...P14_SCENE_IDS,...P15_SCENE_IDS,...P16_SCENE_IDS,...P17_SCENE_IDS] as const;
      for(const id of ids)this.root.querySelectorAll<HTMLElement>(`#stage [data-sticker="${id}"]`).forEach(el=>{el.outerHTML=sceneSticker(id,'',Number(el.getAttribute('width'))||34);});
    }
    const developer = isDeveloperMode(location.search,this.profile.settings);
    this.root.querySelector('.page-shell')!.classList.toggle('clean-mode',!developer);
    document.documentElement.classList.toggle('clean-player-mode',!developer);
    if (force) {
      document.documentElement.lang = getLanguage();
      document.title = t('app.title');
      const guideVars = { cost: ECONOMY.summonCost, count: ECONOMY.summonCount };
      this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n!, guideVars); });
      this.root.querySelectorAll<HTMLElement>('[data-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.label!)); });
      this.root.querySelectorAll<HTMLButtonElement>('.language-switch button').forEach(button => {
        const selected = button.dataset.action === getLanguage();
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      this.canvas.setAttribute('aria-label', `${t('hud.map')}. ${t('guide.controls')} ${t('keyboard.help')}`);
      this.updateSelect('dev-unit', Object.keys(UNITS), id => unitName(id));
      this.updateSelect('dev-boss', BOSS_IDS, id => t(`boss.${id}`));
      this.updateSelect('dev-rank', RANKS.map(rank => String(rank.index)), id => `${id} · ${t(`rank.${id}`)}`);
      this.element<HTMLSelectElement>('dev-rank').value = String(getRank(this.profile.stars).index);
      this.element('dev-map').innerHTML = `<option value="auto">${tr('m3.autoMap', { map: t(`map.${resolveMap(this.profile)}`) })}</option>${MAP_IDS.map(id => `<option value="${id}">${tr(`map.${id}`)}</option>`).join('')}`;
      this.element<HTMLSelectElement>('dev-map').value = this.devMapOverride ?? 'auto';
      this.renderMenu();
      this.inspectorStamp = '';
      this.keyboardStamp = '';
      if (this.dialogKind) this.renderDialog();
    }
    this.element('stage').classList.toggle('menu-mode', !state);
    this.element('menu-screen').hidden = !!state;
    this.element('battle-hud').hidden = !state;
    this.element('battle-actions').hidden = !state;
    this.canvas.hidden = false;
    this.element('rotate-hint').hidden = this.rotateDismissed;
    this.element('fullscreen-button').hidden = typeof document.documentElement.requestFullscreen !== 'function';
    this.element('battle-props').hidden = !state;
    this.renderBattleHUD();
    this.element('profile-mode').textContent = t(isTestProfile() ? 'm2.testMode' : 'm2.normalMode');
    this.element('profile-mode').classList.toggle('test-mode', isTestProfile());
    if (!this.drag && !this.propDrag) {
      const quickStamp = JSON.stringify([getLanguage(), this.profile.ownedProps, this.profile.equippedActiveProps, this.profile.equippedPassiveProps]);
      if (quickStamp !== this.quickStamp) { this.element('quick-loadout').innerHTML = propSlots(this.profile, true); this.quickStamp = quickStamp; }
      this.renderBattleProps();
    }
    const selected = state?.units.find(unit => unit.id === this.selectedId);
    const sealed = !!selected?.statuses.SEALED;
    this.element('sealed-hint').hidden = !sealed;
    this.element('sealed-hint').textContent = t('m2.sealed');
    this.root.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('[data-battle]').forEach(el => { el.disabled = !active; });
    this.element('dev-state').textContent = t(`hud.${!state ? 'preparing' : state.phase === 'ready' ? 'preparing' : state.phase}`);
    this.element('dev-wave').textContent = state ? `${Math.max(1, state.wave)} / ${WAVES.length}` : '✿';
    this.element('dev-tip').textContent = !state ? t('dev.startFirst')
      : state.wave === 1 && state.spawned === 0 && state.waveTime < FIRST_WAVE_PREPARATION
        ? t('hud.preparation', { time: Math.ceil(FIRST_WAVE_PREPARATION - state.waveTime) })
        : t(state.wave === WAVES.length ? 'hud.lastWave' : 'hud.nextWave', { time: Math.floor(state.waveTime), duration: WAVE_DURATION });
    this.element('dev-live').textContent = state ? `${t('dev.units', { count: state.units.filter(unit => unit.side === 'player' && unit.location.zone === 'board').length })} · ${t('dev.enemies', { count: state.enemies.filter(enemy => enemy.side === 'player').length })}` : '';
    this.root.querySelectorAll<HTMLButtonElement>('[data-action^="speed-"]').forEach(button => { button.classList.toggle('selected', button.dataset.action === `speed-${this.speed}`); });
    this.element('hud-speed').textContent = `${this.speed}×`;
    this.element('hud-speed').dataset.speed=String(this.speed);
    this.element<HTMLButtonElement>('hud-speed').disabled = !active;
    this.element<HTMLButtonElement>('pause-button').disabled = state?.phase !== 'playing';
    if (state) {
      const player = state.sides.player;
      const remaining = state.units.filter(unit => unit.side === 'player' && unit.location.zone === 'bench').length;
      const cost = getSummonCost(player.summons);
      const shortage = Math.max(0, Math.ceil(cost - player.food));
      const summonTitle = t(remaining > 0 ? 'hud.redraw' : 'hud.summon');
      const refreshCount=player.lockedBenchSlot==null?5:4;
      const summonNote = t(remaining > 0 ? 'hud.redrawCost' : 'hud.cost', { remaining, cost, count: refreshCount });
      const waveLabel=this.element('hud-wave');
      if(state.endless){const html=p13WaveMarkup(state);if(waveLabel.innerHTML!==html)waveLabel.innerHTML=html;}
      else waveLabel.textContent=`🌊 ${Math.max(1,state.wave)}/${WAVES.length}`;
      this.element('hud-wave').closest('.wave-pill')?.classList.toggle('endless-wave',!!state.endless);
      this.element('orange-value').textContent = `×${player.oranges}`;
      this.element('food-value').textContent = String(Math.floor(player.food));
      this.element('battle-clock').textContent = clock(state.time);
      this.element('battle-clock').setAttribute('aria-label', `${t('hud.time')} ${clock(state.time)}`);
      this.element('summon-cost').textContent = String(cost);
      // An occupied bench can be replaced. Low-food clicks explain that the current pack is retained.
      this.element<HTMLButtonElement>('summon-button').disabled = !active;
      this.element('summon-button').classList.toggle('unaffordable', shortage > 0);
      this.element('summon-button').setAttribute('aria-label', `${summonTitle}. ${summonNote}${shortage ? `. ${t('hud.noFood', { count: shortage })}` : ''}`);
      this.element('summon-refresh-count').textContent=`↻${refreshCount}`;
      this.element('summon-refresh-count').setAttribute('title',t('p6.refreshSlots',{count:refreshCount}));
      this.renderHeroMergeAlert(state);
    }
    // Keep the canvas fixed in the viewport while a pointer is captured. Replacing
    // a tall hero inspector with the short shovel card can otherwise clamp page
    // scroll and move the board underneath the finger before pointerup.
    if (!this.drag && !this.propDrag) {
      this.renderInspector();
      this.renderKeyboard();
    }
    this.renderLiveCard();
    // The tutorial avoids the card after this frame has applied its new content/side.
    this.renderTutorial();
    this.renderPassives();
    this.renderEarlyWaveTip();
    const toast = this.element('toast');
    toast.hidden = !this.toast || performance.now() > this.toast.until;
    if (this.toast) {
      const message = t(this.toast.key, this.toast.vars);
      if (toast.textContent !== message) toast.textContent = message;
      toast.classList.toggle('toast-error', this.toast.error);
      this.positionToast(toast, developer);
    }
  }

  private positionToast(toast: HTMLElement, developer: boolean): void {
    const style = toast.style;
    if (developer) {
      Object.assign(style, { left: '', right: '', top: '', bottom: '', width: '', maxWidth: '', transform: '' });
      return;
    }
    if (toast.hidden || !Number.isFinite(window.innerWidth) || !Number.isFinite(window.innerHeight)) return;
    const stage = this.element('stage').getBoundingClientRect();
    const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
    const rightSpace = viewportWidth - stage.right - 32, leftSpace = stage.left - 32;
    const side = rightSpace >= 120 ? 'right' : leftSpace >= 120 ? 'left' : undefined;
    const width = Math.min(320, side === 'right' ? rightSpace : side === 'left' ? leftSpace : viewportWidth - 32);
    Object.assign(style, {
      left: side === 'right' ? `${stage.right + 16}px` : side === 'left' ? '16px' : '50%',
      right: 'auto', top: 'auto', bottom: '8px', width: `${width}px`, maxWidth: `${width}px`,
      transform: side ? 'none' : 'translateX(-50%)',
    });
    // Measure after setting width: translated or long notices may wrap to more lines.
    const height = toast.getBoundingClientRect().height;
    if (!side) {
      // Short, narrow viewports have no exterior gutter. Keep the notice in the
      // upper board, beyond HUD controls and well above the bottom action strip.
      const top = Math.max(8, Math.min(stage.top + stage.height * STAGE.boardY / STAGE.height + 6, viewportHeight - height - 8));
      Object.assign(style, { top: `${top}px`, bottom: 'auto' });
      const card=this.root?.querySelector<HTMLElement>('#live-unit-card')?.getBoundingClientRect();
      if(card&&card.width>0&&top<card.bottom&&top+height>card.top&&viewportWidth/2-width/2<card.right&&viewportWidth/2+width/2>card.left){
        const zones=[{left:Math.max(16,stage.left+8),right:card.left-8},{left:card.right+8,right:Math.min(viewportWidth-16,stage.right-8)}];
        const zone=zones.sort((a,b)=>(b.right-b.left)-(a.right-a.left))[0],space=zone.right-zone.left;
        if(space>=160){const fitted=Math.min(width,space);Object.assign(style,{left:`${zone.left+(space-fitted)/2}px`,width:`${fitted}px`,maxWidth:`${fitted}px`,transform:'none'});}
      }
    }
  }

  private updateSelect(id: string, ids: readonly string[], label: (id: string) => string): void {
    const select = this.element<HTMLSelectElement>(id);
    const previous = select.value;
    select.innerHTML = ids.map(value => `<option value="${esc(value)}">${esc(label(value))}</option>`).join('');
    if (ids.includes(previous)) select.value = previous;
  }

  private renderMenu(): void {
    this.element('menu-screen').innerHTML = courtyardMarkup(this.profile);
  }

  private renderBattleProps(): void {
    const player = this.engine?.state.sides.player;
    if (!player) return;
    const active = this.canInteract();
    const stamp = JSON.stringify([getLanguage(), active, player.loadout, player.sprinklerUsed, this.selectedProp, Object.entries(player.propCooldowns).map(([id, time]) => [id, Math.ceil(time)])]);
    if (stamp === this.battlePropsStamp) return;
    this.battlePropsStamp = stamp;
    const slots = Array.from({ length: 2 }, (_, slot) => {
      const id = player.loadout.equippedActiveProps[slot]; const prop = PROPS[id];
      const cooldown = Math.ceil(player.propCooldowns[id] ?? 0);
      const name = prop ? t(`prop.${id}`) : t('m2.emptySlot');
      const status = cooldown ? t('m2.cooldown', { time: cooldown }) : t('m2.ready');
      return `<button type="button" class="battle-prop prop-${slot} ${id === this.selectedProp ? 'selected' : ''}" data-action="${prop ? `prop:${id}` : 'battle-shop'}" ${prop ? `data-prop-drag="${id}"` : ''} aria-label="${esc(name)}${prop ? `. ${esc(status)}. ${tr(`prop.${id}.desc`)}` : ''}" title="${prop ? tr(`prop.${id}.desc`) : esc(name)}"${(prop ? !active || cooldown : !this.engine?.canSyncPreparationLoadout()) ? ' disabled' : ''}><span>${prop ? propSticker(id,46) : '+'}</span>${prop ? `<b>${cooldown ? `${cooldown}s` : '1'}</b>` : ''}</button>`;
    }).join('');
    const targetKind=this.selectedProp?propTargetKind(this.selectedProp):undefined;
    this.element('battle-props').innerHTML = `<button type="button" class="sprinkler-button" data-action="sprinkler" data-prop-drag="sprinkler" title="${tr('m2.sprinklerDesc')}" aria-label="${tr('m2.sprinkler')}. ${tr(player.sprinklerUsed ? 'm2.sprinklerUsed' : 'm2.sprinklerReady')}"${!active || player.sprinklerUsed ? ' disabled' : ''}><span>${sceneSticker('sprinkler',propSticker('washer',46),46)}</span><b>${player.sprinklerUsed ? '0' : '1'}</b></button>${slots}${targetKind ? `<p class="prop-target-hint" role="status">${tr(targetKind==='self'?'p13.targetField':targetKind === 'road' ? 'm2.targetRoad' : 'm2.targetUnit')}</p>` : ''}`;
  }

  private renderPassives():void {
    const rail=this.element('passive-rail'),state=this.engine?.state;
    rail.hidden=!state||state.phase==='finished';if(!state||rail.hidden)return;
    const preparation=!!this.engine?.canSyncPreparationLoadout();
    const stamp=JSON.stringify([getLanguage(),preparation,state.sides.player.loadout,this.passiveInfoId]);
    if(stamp!==this.passiveStamp){rail.innerHTML=passiveRailMarkup(state,preparation,this.passiveInfoId);this.passiveStamp=stamp;}
  }

  private markEarlyTipSeen():void {
    // Prototype-only command tests do not mount a player profile.
    if(this.profile&&!this.profile.earlyWaveTipSeen)this.persistProfile({...this.profile,earlyWaveTipSeen:true});
  }

  private renderEarlyWaveTip():void {
    const overlay=this.element('early-wave-coachmark'),button=this.element('early-wave-button');
    const early=this.engine?.canCallEarlyWave();
    const show=!!early?.allowed&&this.tutorialStep==='done'&&!this.profile.earlyWaveTipSeen&&!this.dialogKind&&!this.drag&&!this.propDrag&&!this.selectedProp&&!this.shovelSelected&&!this.transitionUntil;
    overlay.hidden=!show;button?.classList.toggle('early-coached',show);
    if(!show||!early||!button)return;
    const stamp=`${getLanguage()}:${early.bonusFood}`;
    if(stamp!==this.earlyTipStamp){overlay.innerHTML=earlyWaveCoachmarkMarkup(early.bonusFood);this.earlyTipStamp=stamp;}
    const bounds=this.canvas.getBoundingClientRect(),target=button.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    const relative=(rect:DOMRect):TutorialRect=>({x:(rect.left-bounds.left)/bounds.width*STAGE.width,y:(rect.top-bounds.top)/bounds.height*STAGE.height,w:rect.width/bounds.width*STAGE.width,h:rect.height/bounds.height*STAGE.height});
    const pointer=overlay.querySelector<HTMLElement>('.early-tip-pointer')!,r=relative(target);
    pointer.style.left=`${(r.x+r.w*.65)/STAGE.width*100}%`;pointer.style.top=`${(r.y+r.h+4)/STAGE.height*100}%`;
    const bubble=overlay.querySelector<HTMLElement>('.early-tip-bubble')!;
    if(window.innerWidth<=760&&window.innerHeight>window.innerWidth){bubble.style.removeProperty('left');bubble.style.removeProperty('top');return;}
    const avoid=[r,...[...this.root.querySelectorAll<HTMLElement>('.control-dock,.resource-dock,#boss-banner,#live-unit-card,#passive-rail,#battle-props,#summon-button,#toast')].filter(el=>!el.hidden).map(el=>relative(el.getBoundingClientRect()))];
    const measured=bubble.getBoundingClientRect(),size={w:measured.width/bounds.width*STAGE.width,h:measured.height/bounds.height*STAGE.height};
    const position=placeTutorialBubble(avoid,size);
    bubble.style.left=`${position.x/STAGE.width*100}%`;bubble.style.top=`${position.y/STAGE.height*100}%`;
  }

  private renderBattleHUD(): void {
    const state=this.engine?.state, banner=this.element('boss-banner');
    if(!state){banner.hidden=true;return;}
    const preview=this.engine!.getUpcomingWavePreview(),early=this.engine!.canCallEarlyWave();
    if(this.tutorialStep!=='done')early.allowed=false;
    const strategyStamp=JSON.stringify([getLanguage(),preview,early]);
    if(strategyStamp!==this.waveStrategyStamp){this.element('wave-strategy').innerHTML=waveStrategyMarkup(preview,early);this.waveStrategyStamp=strategyStamp;}
    const wave=getWaveHUD(state), progress=this.element('wave-progress');
    progress.dataset.kind=wave.kind;
    progress.setAttribute('aria-valuenow',String(Math.round(wave.fraction*100)));
    progress.setAttribute('aria-label',t(wave.kind==='preparation'?'p1.prepare':'p1.waveProgress',{time:wave.remaining}));
    progress.querySelector<HTMLElement>('i')!.style.width=`${wave.fraction*100}%`;
    progress.querySelector('span')!.textContent=wave.kind==='preparation'?`⏱ ${wave.remaining}s`:'';
    const boss=getBossHUD(state);
    banner.hidden=!boss;
    if(!boss){this.bossStamp='';return;}
    const stamp=`${getLanguage()}:${boss.id}:${boss.count}`;
    if(stamp!==this.bossStamp){
      this.bossStamp=stamp;
      banner.innerHTML=`<div class="boss-portrait">${unitSticker(boss.kind,40)}</div><div class="boss-detail"><div class="boss-heading"><strong>${tr(`boss.${boss.kind}`)}${boss.count>1?` ×${boss.count}`:''}</strong><small class="boss-numbers"></small></div><div class="boss-hp" role="progressbar" aria-valuemin="0"><i></i></div><div class="boss-skill" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i><span aria-hidden="true"></span></div></div>`;
    }
    banner.classList.toggle('skill-warning',boss.warning);
    banner.querySelector('.boss-numbers')!.textContent=`${formatCompactNumber(boss.hp)} / ${formatCompactNumber(boss.maxHp)}`;
    const hp=banner.querySelector<HTMLElement>('.boss-hp')!;
    hp.setAttribute('aria-valuemax',String(boss.maxHp));hp.setAttribute('aria-valuenow',String(boss.hp));
    hp.setAttribute('aria-label',t('p1.bossHP',{hp:boss.hp,max:boss.maxHp}));
    hp.querySelector<HTMLElement>('i')!.style.width=`${boss.fraction*100}%`;
    banner.querySelector<HTMLElement>('.boss-skill i')!.style.width=`${(1-boss.cooldownFraction)*100}%`;
    banner.querySelector('.boss-skill span')!.textContent=t(boss.warning?'p1.bossSoon':'p1.bossCooldown',{time:boss.cooldown});
    const skill=banner.querySelector<HTMLElement>('.boss-skill')!;
    skill.setAttribute('aria-valuenow',String(Math.round((1-boss.cooldownFraction)*100)));
    skill.setAttribute('aria-label',t(boss.warning?'p1.bossSoon':'p1.bossCooldown',{time:boss.cooldown}));
  }

  private renderTutorial():void {
    const state=this.engine?.state, overlay=this.element('tutorial-overlay');
    overlay.hidden=!state||state.phase!=='playing'||this.tutorialStep==='done';
    if(overlay.hidden||!state)return;
    const button=this.root.querySelector<HTMLElement>('#battle-hud [data-action="recipes"]')?.getBoundingClientRect(),bounds=this.canvas.getBoundingClientRect();
    const guide=button&&bounds.width&&bounds.height?{x:(button.left-bounds.left)/bounds.width*STAGE.width,y:(button.top-bounds.top)/bounds.height*STAGE.height,w:button.width/bounds.width*STAGE.width,h:button.height/bounds.height*STAGE.height}:undefined;
    const stageRect=(rect:DOMRect):TutorialRect=>({x:(rect.left-bounds.left)/bounds.width*STAGE.width,y:(rect.top-bounds.top)/bounds.height*STAGE.height,w:rect.width/bounds.width*STAGE.width,h:rect.height/bounds.height*STAGE.height});
    const card=this.element('live-unit-card');
    if(card&&bounds.width&&bounds.height&&window.innerWidth>window.innerHeight){
      const targets=tutorialTargets(this.tutorialStep,state,guide);
      const spots=[targets.source,targets.target].filter((r):r is TutorialRect=>!!r);
      card.classList.toggle('dock-left',false);const right=stageRect(card.getBoundingClientRect());
      card.classList.toggle('dock-left',true);const left=stageRect(card.getBoundingClientRect());
      card.classList.toggle('dock-left',tutorialCardDock(spots,right,left)==='left');
    }
    const avoidRects:TutorialRect[]=[];
    if(bounds.width&&bounds.height)for(const id of ['live-unit-card','boss-banner','enemy-alert-banner']){
      const element=this.element(id);if(!element)continue;
      const rect=element.getBoundingClientRect();
      if(!element.hidden&&rect.width>0&&rect.height>0)avoidRects.push({x:(rect.left-bounds.left)/bounds.width*STAGE.width,y:(rect.top-bounds.top)/bounds.height*STAGE.height,w:rect.width/bounds.width*STAGE.width,h:rect.height/bounds.height*STAGE.height});
    }
    const stamp=JSON.stringify([this.tutorialStep,getLanguage(),guide,avoidRects,bounds.width,bounds.height,this.selectedId,state.grid,state.units.map(unit=>[unit.id,unit.kind,unit.level,unit.location])]);
    if(stamp===this.tutorialStamp)return;
    this.tutorialStamp=stamp;
    overlay.innerHTML=tutorialMarkup(this.tutorialStep,state,this.selectedId,guide,avoidRects);
    const bubble=overlay.querySelector<HTMLElement>('.tutorial-bubble');
    // Portrait uses its own letterbox above the stage. Landscape measures the real
    // translated bubble, not an estimated height that misses wrapped mobile text.
    if(bubble&&bounds.width>0&&bounds.height>0&&!(window.innerWidth<=760&&window.innerHeight>window.innerWidth)){
      const rect=bubble.getBoundingClientRect(),targets=tutorialTargets(this.tutorialStep,state,guide);
      if(rect.width>0&&rect.height>0){
        const position=placeTutorialBubble([...avoidRects,...[targets.source,targets.target].filter((r):r is TutorialRect=>!!r)],{w:rect.width/bounds.width*STAGE.width,h:rect.height/bounds.height*STAGE.height});
        bubble.style.setProperty('--bubble-left',`${position.x/STAGE.width*100}%`);
        bubble.style.top=`${position.y/STAGE.height*100}%`;
        bubble.style.setProperty('--tutorial-top',bubble.style.top);
      }
    }
  }

  private progressTutorial(action:TutorialAction):void {
    if(this.tutorialStep==='done')return;
    const next=advanceTutorial(this.tutorialStep,action);
    if(next==='done'){
      const result=finishTutorial(this.profile,action!=='skip');
      if(!this.persistProfile(result.profile))return;
      this.tutorialStep='done';this.tutorialStamp='';
      this.engine?.setTutorialHold(false);
      const completion=action==='skip'?'p1.tutorialSkipped':result.awarded?'p1.tutorialReward':'p1.tutorialDone';
      const state=this.engine?.state;
      const waitingHero=state?.units.some(u=>u.side==='player'&&u.location.zone==='bench'&&!!HEROES[u.kind]);
      const openPad=state?.grid.some((row,y)=>row.some((tile,x)=>tile==='O'&&!state.units.some(u=>u.location.zone==='board'&&u.location.col===x&&u.location.row===y)));
      this.notify(waitingHero&&openPad?'p6.tutorialDeployToast':completion,false,{completion:t(completion)});
    }else {this.tutorialStep=next;this.refresh();}
  }

  private renderInspector(): void {
    const state = this.engine?.state;
    const player = state?.sides.player;
    const unit = state?.units.find(item => item.id === this.selectedId && item.side === 'player');
    const unitStats = unit && unit.kind !== 'shovel' ? this.engine!.getUnitStats(unit) : undefined;
    const shovelRules = this.engine?.getShovelRules('player') ?? SHOVEL_PRODUCTION;
    const shovelStatus = !player || state?.phase === 'finished' ? ''
      : player.shovels >= shovelRules.maxStored ? t('inspect.shovelFull', { count: shovelRules.maxStored })
        : t('inspect.shovelNext', { time: Math.max(0, Math.ceil(shovelRules.interval - player.shovelTimer)), amount: SHOVEL_PRODUCTION.amount });
    const stamp = JSON.stringify([getLanguage(), this.shovelSelected, unit?.id, unit?.level, unit?.location, unitStats, unit && Object.entries(unit.statuses).map(([key, time]) => [key, Math.ceil(time ?? 0)]), unit?.energy, player?.shovels, !unit || this.shovelSelected ? shovelStatus : '']);
    if (stamp === this.inspectorStamp) return;
    this.inspectorStamp = stamp;
    const target = this.element('inspector');
    if (this.shovelSelected) {
      target.innerHTML = `<div class="selected-pet"><span class="selected-icon" aria-hidden="true">⚒</span><div><span class="eyebrow">${tr('inspect.select')}</span><h3>${tr('inspect.shovel')}</h3></div></div><p>${tr('inspect.shovelBody')}</p><strong class="shovel-count">${tr('hud.shovel', { count: player?.shovels ?? 0 })}</strong>${shovelStatus ? `<p class="shovel-recharge">${esc(shovelStatus)}</p>` : ''}<button type="button" class="text-button" data-action="clear">${tr('inspect.cancel')}</button>`;
      return;
    }
    if (!unit) { target.innerHTML = `<div class="empty-inspector"><span aria-hidden="true">☁</span><p>${tr('inspect.empty')}</p></div><p class="shovel-help">${tr('guide.shovel', { time: shovelRules.interval, amount: SHOVEL_PRODUCTION.amount, max: shovelRules.maxStored })}</p>${shovelStatus ? `<p class="shovel-recharge">${esc(shovelStatus)}</p>` : ''}`; return; }
    if (unit.kind === 'shovel') {
      target.innerHTML = `<div class="selected-pet"><span class="selected-icon">${icon(unit.kind)}</span><div><span class="eyebrow">${tr('inspect.tool')}</span><h3>${tr('unit.shovel')}</h3></div></div><p>${tr('inspect.toolBody')}</p><strong class="shovel-count">${tr('hud.shovel', { count: player?.shovels ?? 0 })}</strong><button type="button" class="button button-light" data-target="shovel">${tr('inspect.storeShovel')}</button><button type="button" class="text-button" data-action="clear">${tr('inspect.cancel')}</button>`;
      return;
    }
    const hero = HEROES[unit.kind];
    const basic = UNITS[unit.kind];
    const stats = unitStats!;
    const charge = hero ? stats.charge : 0;
    const recipe = RECIPES.find(item => item.hero === unit.kind);
    const related = RECIPES.filter(item => (item.parts as readonly string[]).includes(unit.kind));
    const damage = Math.round(stats.damage);
    const statuses = Object.entries(unit.statuses).filter(([, duration]) => (duration ?? 0) > 0);
    const place = unit.location.zone === 'bench' ? t('inspect.bench', { slot: unit.location.slot + 1 }) : t('inspect.board', { col: unit.location.col + 1, row: unit.location.row + 1 });
    let description = '';
    if (hero) description = `<div class="skill-box"><span class="eyebrow">${tr('inspect.skill')}</span><h4>${tr(`skill.${unit.kind}`)}</h4><p>${tr(`skill.${unit.kind}.desc`, { charge })}</p><div class="energy-track"><i style="width:${Math.min(100, unit.energy / charge * 100)}%"></i></div><small>${tr('inspect.energy', { value: unit.energy, total: charge })}</small></div><p>${tr('inspect.feed')}</p><div class="ingredient-row">${recipe?.parts.map(part => `<span>${icon(part)}${esc(unitName(part))}</span>`).join('<b> / </b>') ?? ''}</div>`;
    else if (basic.category === 'component') description = `<p>${tr('inspect.combine')}</p><div class="related-recipes">${related.map(item => { const other = item.parts.find(part => part !== unit.kind)!; return `<div>${icon(other)}<span>${esc(unitName(other))}<small>→ ${tr(`hero.${item.hero}`)}</small></span></div>`; }).join('')}</div>${unit.kind === 'shiba' || unit.kind === 'hat_wizard' ? `<p class="tiny-warning">${tr('recipe.doge')}</p>` : ''}`;
    else if (unit.kind === 'bee') { const production = BEE_PRODUCTION[unit.level - 1]; description = `<p class="skill-box">${tr('inspect.bee', { time: production.interval, amount: production.amount })}</p>`; }
    else description = `<p>${tr('inspect.merge', { level: basic.maxLevel })}</p>`;
    if (unit.statuses.SEALED) description = `<p class="sealed-warning" role="status">${tr('m2.sealed')}</p>` + description;
    description = `<p>${tr('m2.rate', { value: Number(stats.rate.toFixed(2)) })}</p>` + description;
    target.innerHTML = `<div class="selected-pet"><span class="selected-icon">${icon(unit.kind)}</span><div><span class="eyebrow">${tr(hero ? 'inspect.hero' : basic.category === 'basic' ? 'inspect.basic' : 'inspect.component')}</span><h3>${esc(unitName(unit.kind))}</h3><b class="level-badge">${tr('inspect.level', { level: unit.level })}</b></div></div><div class="unit-stats"><span>${tr('inspect.damage', { value: damage })}</span><span>${tr('inspect.range', { value: Number(stats.range.toFixed(2)) })}</span></div><div class="status-list">${statuses.length ? statuses.map(([status, duration]) => `<span>${tr(`status.${status}`)} · ${tr('time.seconds', { value: Math.ceil(duration!) })}</span>`).join('') : `<span class="status-ok">${tr('inspect.noStatus')}</span>`}</div>${description}<p class="location-caption">${tr('inspect.location', { place })}</p><button type="button" class="text-button" data-action="clear">${tr('inspect.cancel')}</button>`;
  }

  private renderKeyboard(): void {
    const state = this.engine?.state;
    const stamp = JSON.stringify([getLanguage(), state?.phase, state?.grid, state?.units.filter(unit => unit.side === 'player').map(unit => [unit.id, unit.kind, unit.level, unit.location]), this.selectedId, this.shovelSelected, state?.sides.player.shovels]);
    if (stamp === this.keyboardStamp) return;
    this.keyboardStamp = stamp;
    const container = this.element('keyboard-controls');
    const oldFocus = document.activeElement instanceof HTMLElement && container.contains(document.activeElement) ? document.activeElement.dataset.target : undefined;
    if (!state) { container.innerHTML = `<p class="muted">${tr('dev.startFirst')}</p>`; return; }
    const disabled = state.phase === 'playing' ? '' : ' disabled';
    const nests = Array.from({ length: ECONOMY.benchSize }, (_, slot) => {
      const unit = this.unitAt({ kind: 'bench', slot });
      const name = unit ? `${unitName(unit.kind)}${unit.kind === 'shovel' ? '' : ` · ${t('inspect.level', { level: unit.level })}`}` : t('keyboard.empty');
      return `<button type="button" class="key-cell ${unit?.id === this.selectedId ? 'key-selected' : ''}" data-target="bench:${slot}" aria-label="${tr('keyboard.bench', { slot: slot + 1, name })}" title="${esc(name)}"${disabled}>${unit ? icon(unit.kind) : slot + 1}</button>`;
    }).join('');
    const cells: string[] = [];
    for (let row = 0; row < STAGE.rows; row++) for (let col = 0; col < STAGE.cols; col++) {
      const unit = this.unitAt({ kind: 'cell', col, row });
      const tile = state.grid[row][col];
      const name = unit ? `${unitName(unit.kind)} · ${t('inspect.level', { level: unit.level })}` : t(`tile.${tile}`);
      cells.push(`<button type="button" class="key-cell tile-${tile} ${unit?.id === this.selectedId ? 'key-selected' : ''}" data-target="cell:${col}:${row}" aria-label="${tr('keyboard.cell', { row: row + 1, col: col + 1, name })}" title="${esc(name)}"${disabled}>${unit ? icon(unit.kind) : tile === 'G' ? '·' : tile === 'O' ? '+' : tile === 'B' ? '×' : tile === 'C' ? '♨' : tile === 'S' ? '↗' : '—'}</button>`);
    }
    container.innerHTML = `<div class="keyboard-nests">${nests}</div><button type="button" class="button button-light keyboard-shovel ${this.shovelSelected ? 'key-selected' : ''}" data-target="shovel"${disabled}>${tr('hud.shovel', { count: state.sides.player.shovels })}</button><div class="keyboard-grid">${cells.join('')}</div>`;
    if (oldFocus) container.querySelector<HTMLButtonElement>(`[data-target="${oldFocus}"]`)?.focus({ preventScroll: true });
  }

  private lootMarkup(loot: string[]): string { return illustratedLoot(loot); }

  private showDialog(kind: DialogKind): void {
    this.dialogKind = kind;
    this.renderDialog();
    if (!this.dialog.open) this.dialog.showModal();
    this.focusCompendium();
  }

  private focusCompendium(): void {
    if(this.dialogKind!=='recipes')return;
    const target=this.dialog.querySelector<HTMLElement>('[data-compendium-focused="true"]');
    target?.focus({preventScroll:true});target?.scrollIntoView?.({block:'nearest'});
  }

  private renderDialog(): void {
    const kind = this.dialogKind;
    const active=typeof document!=='undefined'&&typeof HTMLElement!=='undefined'&&document.activeElement instanceof HTMLElement&&this.dialog.contains(document.activeElement)?document.activeElement:undefined;
    const focused=active?.dataset.action,rarityFocus=active?.dataset.rarity;
    const propRowFocus=active?.closest<HTMLElement>('.prop-row')?.dataset.propId;
    const ledgerPage=!!kind&&['recipes','armory','market','profile','leaderboard','endless-board','settings','pause','result','kitchen','village','medallions'].includes(kind);
    const stamp=JSON.stringify([kind,kind==='recipes'?this.compendium.viewKey:kind==='market'||kind==='armory'?this.meta.viewKey:kind==='kitchen'?this.kitchen.viewKey:kind==='village'?this.village.viewKey:kind==='medallions'?this.medallions.viewKey:null]);
    // P17: keep an unsaved nickname, its caret and focus across board re-renders.
    const nickname=kind==='endless-board'?this.dialog.querySelector<HTMLInputElement>('[data-endless-nickname]'):null;
    const typing=!!nickname&&typeof document!=='undefined'&&document.activeElement===nickname,caret=typing?[nickname!.selectionStart,nickname!.selectionEnd]:null;
    const scrolls=['.ledger-body'].map(selector=>({selector,top:stamp===this.ledgerStamp?this.dialog.querySelector<HTMLElement>(selector)?.scrollTop??0:0}));
    this.ledgerStamp=stamp;
    this.dialog.classList.toggle('ledger-dialog',ledgerPage);
    this.dialog.classList.toggle('pause-ledger',kind==='pause');
    this.dialog.classList.toggle('result-ledger',kind==='result');
    this.dialog.classList.toggle('endless-offer-ledger',kind==='endless-offer');
    this.dialog.classList.toggle('settings-dialog',kind==='settings');
    this.dialog.classList.toggle('recipe-dialog', kind === 'recipes');
    this.dialog.classList.toggle('meta-dialog', kind === 'armory' || kind === 'market' || kind === 'kitchen' || kind === 'village' || kind === 'medallions');
    this.dialog.classList.toggle('medallion-dialog', kind === 'medallions');
    this.dialog.classList.toggle('endless-board-dialog', kind === 'endless-board');
    this.dialog.classList.toggle('endless-hub-dialog', kind === 'medallions' || (kind === 'endless-board' && this.endlessHubMode));
    this.dialog.classList.toggle('kitchen-dialog', kind === 'kitchen');
    this.dialog.classList.toggle('village-dialog', kind === 'village');
    this.dialog.classList.toggle('profile-dialog', kind === 'profile' || kind === 'leaderboard' || kind === 'endless-board');
    this.dialog.setAttribute('aria-labelledby', 'dialog-title');
    if (kind === 'profile' || kind === 'leaderboard' || kind === 'endless-board' || kind === 'settings') {
      this.dialog.innerHTML = this.profileScreens.markup(kind);
      if (typing) { const input = this.dialog.querySelector<HTMLInputElement>('[data-endless-nickname]'); input?.focus({ preventScroll: true }); if (input && caret) input.setSelectionRange(caret[0], caret[1]); }
      if(kind==='settings')this.dialog.querySelector<HTMLInputElement>('[data-setting="developerMode"]')!.checked=isDeveloperMode(location.search,this.profile.settings);
    } else if (kind === 'armory' || kind === 'market') {
      this.dialog.innerHTML = this.meta.markup(kind,!!this.engine,!!this.engine?.canSyncPreparationLoadout());
    } else if (kind === 'kitchen') {
      this.dialog.innerHTML = this.kitchen.markup(!!this.engine,!!this.engine?.canSyncPreparationLoadout());
    } else if (kind === 'village') {
      this.dialog.innerHTML = this.village.markup(!!this.engine,!!this.engine?.canSyncPreparationLoadout());
    } else if (kind === 'medallions') {
      this.dialog.innerHTML = this.medallions.markup(!!this.engine,!!this.engine?.canSyncPreparationLoadout());
    } else if (kind === 'pause' && this.engine) {
      this.dialog.innerHTML=pauseMarkup(this.engine.state);
    } else if (kind === 'recipes') {
      this.dialog.innerHTML=this.compendium.markup(this.profile);
    } else if (kind === 'endless-offer' && this.engine?.state.result) {
      this.dialog.innerHTML=endlessOfferMarkup(this.engine.state,this.savedResult);
    } else if (kind === 'result' && this.engine?.state.result) {
      this.dialog.innerHTML=resultMarkup({state:this.engine.state,profile:this.profile,savedResult:this.savedResult,resultStars:this.resultStars,previousRank:this.previousRank,newWeapons:this.newWeapons,newAvatars:this.newAvatars,newRoster:this.newRoster,statsOpen:this.resultStatsOpen,globalRank:this.engine.state.endless?this.globalRank:undefined});
    }
    for(const {selector,top} of scrolls){
      const body=this.dialog.querySelector<HTMLElement>(selector);
      if(body){
        // Restore before another synchronous render reads it; smooth scrolling starts at zero.
        const behavior=body.style.scrollBehavior;
        body.style.scrollBehavior='auto';body.scrollTop=top;body.style.scrollBehavior=behavior;
      }
    }
    if(kind!=='recipes'){
      let target=focused?this.dialog.querySelector<HTMLElement>(`${propRowFocus?`.prop-row[data-prop-id="${CSS.escape(propRowFocus)}"] `:''}[data-action="${CSS.escape(focused)}"]`):rarityFocus!==undefined?this.dialog.querySelector<HTMLElement>(`[data-rarity="${CSS.escape(rarityFocus)}"]`):null;
      if(!target&&focused?.startsWith('meta-buy:'))target=this.dialog.querySelector<HTMLElement>('.shop-row button[data-action^="meta-buy:"]')??this.dialog.querySelector<HTMLElement>('[data-action="meta-refresh"]');
      target?.focus({preventScroll:true});
      // Equipping reorders backpack rows. Keep the exact row control, and reveal it
      // after sorting instead of focusing its duplicate action in the top tray.
      if(propRowFocus||focused?.startsWith('meta-prop:')||focused?.startsWith('meta-buy:'))(target?.closest('.prop-row,.shop-row')??target)?.scrollIntoView?.({block:'nearest'});
    }
    this.focusCompendium();
  }

  private closeDialog(resume: boolean): void {
    if (this.dialog.open) this.dialog.close();
    this.dialogKind = null;
    if (resume && this.engine?.state.phase === 'paused') this.engine.pause(false);
    this.sound.setDucked(this.retainedPage || document.hidden || !!this.engine && this.engine.state.phase !== 'playing');
  }

  private persistProfile(profile: Profile): boolean {
    if (!saveProfile(profile)) { this.notify('hint.storage', true); return false; }
    const unlocked = profile.unlockedAvatars.some(id => !this.profile.unlockedAvatars.includes(id));
    this.acceptPersistedProfile(profile);
    if (unlocked) this.notify('m3.newAvatars');
    return true;
  }

  /** Caller must have persisted successfully before entering this method. */
  private acceptPersistedProfile(profile: Profile): void {
    this.profile = profile;
    this.sound.setSettings(profile.settings);
    if (this.engine?.canSyncPreparationLoadout()) this.engine.syncPreparationLoadout(villageLoadout(profile));
    this.quickStamp = ''; this.battlePropsStamp = ''; this.liveStamp = '';
    this.renderMenu();
  }

  private openModal(kind: 'recipes' | 'kitchen' | 'village' | MetaScreen): void {
    if (!this.modalReturn) {
      const playing=this.engine?.state.phase==='playing';
      this.modalReturn = { dialog: this.dialogKind, resume: playing };
      if (playing) this.engine!.pause(true);
    }
    this.cancelDrag(); this.cancelPropDrag();
    this.showDialog(kind); this.refresh();
  }

  private closeModal(): void {
    const previous=this.modalReturn; this.modalReturn=null;
    if(previous?.dialog) this.showDialog(previous.dialog);
    else this.closeDialog(previous?.resume ?? false);
    this.refresh(true);
  }

  private renderLiveCard(): void {
    const host=this.element('live-card-host'), state=this.engine?.state;
    const unit=state?.units.find(item=>item.side==='player'&&item.id===this.selectedId);
    if(!state||!unit||this.drag?.moved||this.propDrag?.moved){host.innerHTML='';this.liveStamp='';return;}
    const stats=this.engine!.getEffectiveUnitStats(unit),loadout=state.sides.player.loadout;
    // Energy and countdowns change independently of recipe and button structure.
    const allowBenchLock=this.tutorialStep==='done';
    const endless=this.liveEndlessInfo(unit);
    const stamp=JSON.stringify([getLanguage(),unit.id,unit.kind,unit.level,unit.location,loadout,allowBenchLock,state.sides.player.lockedBenchSlot,!!state.endless,!!unit.awakened,unit.breakthroughFails??0,
      state.grid,state.units.map(u=>[u.id,u.kind,u.level,u.location,!!u.washing,!!u.statuses.SEALED,!!u.statuses.MERGE_LOCK])]);
    if(stamp!==this.liveStamp){host.innerHTML=liveUnitCardMarkup({unit,state,stats,loadout,allowBenchLock,endless});this.liveStamp=stamp;}
    host.querySelector('#live-unit-card')?.classList.toggle('dock-left',unit.location.zone==='board'&&unit.location.col>=6);
    const text=(selector:string,value:string)=>{const el=host.querySelector<HTMLElement>(selector);if(el&&el.textContent!==value)el.textContent=value;};
    text('[data-live-stat="damage"]',`⚔️ ${formatCompactNumber(stats.damage)}`);
    if(endless){
      text('[data-live-momentum]',momentumText(endless.momentum));
      if(endless.chance){text('[data-live-chance]',t('p17.breakthroughChance',{pct:Math.round(endless.chance.total*100)}));text('[data-live-breakdown]',breakthroughBreakdown(endless.chance));}
      if(endless.awakenedPower)text('[data-live-power]',t('p17.awakenedPower',{value:formatCompactNumber(endless.awakenedPower)}));
    }
    text('[data-live-stat="rate"]',`⚡ ${Number(stats.rate.toFixed(2))}/s`);
    text('[data-live-stat="range"]',`🎯 ${Number(stats.range.toFixed(1))}`);
    text('[data-live-stat="production"]',t('p3.productionValue',getBeeProduction(unit.level,loadout)));
    const energy=Math.max(0,Math.min(stats.charge,unit.energy));
    text('[data-live-energy-value]',`🔋 ${t('p3.energy',{value:energy,total:stats.charge})}`);
    const bar=host.querySelector<HTMLElement>('[data-live-energy-bar]');
    bar?.setAttribute('aria-valuenow',String(energy));bar?.setAttribute('aria-valuemax',String(stats.charge));
    const fill=host.querySelector<HTMLElement>('[data-live-energy-fill]');if(fill)fill.style.width=`${stats.charge>0?energy/stats.charge*100:0}%`;
    const statuses=host.querySelector<HTMLElement>('[data-live-statuses]');
    if(statuses){const html=Object.entries(unit.statuses).filter(([,time])=>(time??0)>0).map(([id,time])=>`<span class="live-status">${tr(`status.${id}`)} ${Math.ceil(time!)}s</span>`).join('')+(unit.washing?`<span class="live-status">${tr('m2.washing')}</span>`:'');if(statuses.innerHTML!==html)statuses.innerHTML=html;}
  }

  /** P17 hero card extras: momentum, the live breakthrough chance (endless Lv.5) and an awakened hero's endless power. */
  private liveEndlessInfo(unit: Unit): {momentum:number;chance?:ReturnType<BattleEngine['getBreakthroughChance']>;awakenedPower?:number}|undefined {
    const engine=this.engine;if(!engine||!HEROES[unit.kind])return undefined;
    const momentum=engine.getUnitMomentum(unit),endless=!!engine.state.endless,loadout=engine.state.sides.player.loadout;
    return{momentum,
      ...(endless&&unit.level>=5&&!unit.awakened?{chance:engine.getBreakthroughChance(unit)}:{}),
      ...(unit.awakened?{awakenedPower:AWAKENED_DAMAGE*breakthroughAttackMultiplier(getMedallionLevel(loadout,'med_breakthrough_atk'))*momentumMultiplier(momentum,getMedallionLevel(loadout,'med_momentum'))}:{})};
  }

  private openProfileScreen(screen: OverlayScreen): void {
    if (!this.overlayReturn) {
      const playing=this.engine?.state.phase==='playing';
      this.overlayReturn = { dialog: this.dialogKind, resume: playing };
      if (playing) this.engine!.pause(true);
    }
    this.cancelDrag(); this.cancelPropDrag();
    this.showDialog(screen); this.refresh();
    if (screen === 'endless-board') this.refreshBoard();
    if (screen === 'leaderboard') {
      this.syncRankScore();
      this.refreshRankBoard();
    }
    if ((screen === 'endless-board' || screen === 'leaderboard') && this.board.configured && !isTestProfile()
      && (!this.profile.locationMode || this.profile.locationMode === 'unset')
      && typeof navigator !== 'undefined' && !!navigator.geolocation) {
      void this.requestLocation(true);
    }
  }

  private closeProfileScreen(): void {
    const previous = this.overlayReturn;
    this.overlayReturn = null;
    this.endlessHubMode = false;
    this.boardDraft = undefined;
    if (previous?.dialog) this.showDialog(previous.dialog);
    else this.closeDialog(previous?.resume ?? false);
    this.refresh();
  }

  private pause(): void {
    if (this.engine?.state.phase !== 'playing') return;
    this.engine.pause(true);
    this.cancelDrag();
    this.cancelPropDrag();
    this.showDialog('pause');
    this.refresh();
  }

  private notify(key: string, error = false, vars: Record<string, string | number> = {}): void {
    this.toast = { key, vars, error, until: performance.now() + (error ? 4200 : 2600) };
    this.refresh();
  }

  private renderHeroMergeAlert(state:BattleState):void {
    const options=getHeroMergeOptions(state),badge=this.element('redraw-hero-badge');
    badge.hidden=!options.length||!!this.drag||!!this.propDrag||!!this.selectedProp||this.shovelSelected||state.phase!=='playing';
    const choice=options.find(o=>o.heroId===this.mergeLocatorHero)??options[0];
    badge.textContent=choice?t(options.length>1?'p8.heroAlerts':'p8.heroAlert',{hero:t('hero.'+choice.heroId),count:options.length,others:options.length-1}):'';
    badge.setAttribute('aria-label',badge.textContent);
  }

  private apply(result: CommandResult): void {
    const dug = result.key === 'hint.dig' || result.key === 'hint.repaired' || result.key === 'hint.repairProgress';
    if (result.ok && dug) this.sound.play('shovel');
    if (result.ok && result.key === 'hint.merged' && result.unitId && this.engine?.state.units.some(unit => unit.id === result.unitId && !!HEROES[unit.kind] && unit.level === 1)) this.sound.play('merge_hero');
    if (result.key === 'p17.breakthroughSuccess') this.sound.play('merge_hero');
    else if (result.key === 'p17.breakthroughFail') this.sound.play('merge_upgrade');
    if (result.ok && result.unitId) {
      this.selectedId = result.key==='hint.deployed'?undefined:result.unitId;
      this.shovelSelected = false;
    }
    if (result.ok && this.selectedId && !this.engine?.state.units.some(unit => unit.id === this.selectedId && unit.side === 'player')) this.selectedId = undefined;
    const cost = this.engine ? getSummonCost(this.engine.state.sides.player.summons) : ECONOMY.summonCost;
    this.notify(result.key, !result.ok, result.key === 'hint.noFood' ? { cost, count: Math.max(0, Math.ceil(cost - (this.engine?.state.sides.player.food ?? 0))) } : result.value !== undefined ? { value: result.value } : {});
    if(result.ok){
      if(dug)this.progressTutorial('dig');
      if(result.key==='hint.deployed'&&this.engine?.state.units.some(unit=>unit.id===result.unitId&&unit.side==='player'&&unit.location.zone==='board')){
        this.progressTutorial('deploy');
      }
      if((result.key==='hint.merged'||result.key==='hint.fed')&&(this.tutorialStep!==4||this.engine?.state.units.some(unit=>unit.id===result.unitId&&!!HEROES[unit.kind])))this.progressTutorial('merge');
    }
  }

  private canInteract(): boolean { return !this.transitionUntil && this.engine?.state.phase === 'playing'; }

  private clearSelection(): void { this.selectedId = undefined; this.shovelSelected = false; this.selectedProp = undefined; this.passiveInfoId=undefined; this.cancelDrag(); this.cancelPropDrag(); }

  private unitAt(hit: Hit): Unit | undefined {
    return this.engine?.state.units.find(unit => unit.side === 'player' && (hit.kind === 'bench'||hit.kind==='bench-lock'
      ? unit.location.zone === 'bench' && unit.location.slot === hit.slot
      : hit.kind === 'cell' && unit.location.zone === 'board' && unit.location.col === hit.col && unit.location.row === hit.row));
  }

  private activate(hit: Hit, options:{dragged?:boolean;fromKeyboard?:boolean}={}): void {
    if (!this.canInteract() || !this.engine) return;
    if(hit.kind==='bench-lock'){
      if(!options.dragged&&this.tutorialStep==='done'){
        this.selectedProp=undefined;this.shovelSelected=false;this.apply(this.engine.toggleBenchLock(hit.slot));this.refresh();
      }
      return;
    }
    const tap=!options.dragged&&!options.fromKeyboard;
    if (this.selectedProp) {
      if(this.selectedProp==='sprinkler'){
        if(hit.kind==='cell'){this.apply(this.engine.useSprinkler());this.selectedProp=undefined;}
        else this.clearSelection();
        this.refresh();return;
      }
      const prop = PROPS[this.selectedProp];
      const unit = this.unitAt(hit);
      const result = this.engine.useProp(this.selectedProp, prop.target === 'road' && hit.kind === 'cell' ? { col: hit.col, row: hit.row } : { unitId: unit?.id });
      if(tap&&!result.ok&&['m2.invalidTarget','hint.toolOnly','hint.maxLevel'].includes(result.key)){this.clearSelection();this.refresh();return;}
      if (result.ok) this.selectedProp = undefined;
      this.apply(result); this.refresh(); return;
    }
    if (hit.kind === 'shovel') {
      const selected = this.engine.state.units.find(unit => unit.id === this.selectedId && unit.kind === 'shovel' && unit.location.zone === 'bench');
      if (selected) { this.apply(this.engine.storeShovel(selected.id)); this.refresh(); return; }
      this.shovelSelected = !this.shovelSelected;
      this.selectedId = undefined;
      this.refresh();
      return;
    }
    if (this.shovelSelected) {
      if(tap&&(hit.kind!=='cell'||!['G','B'].includes(this.engine.state.grid[hit.row]?.[hit.col]))){this.clearSelection();this.refresh();return;}
      if (hit.kind === 'cell') {
        this.apply(this.engine.dig(hit.col, hit.row));
        if (this.engine.state.sides.player.shovels === 0) this.shovelSelected = false;
      }
      this.refresh();
      return;
    }
    const target = this.unitAt(hit);
    const selected=this.engine.state.units.find(unit=>unit.id===this.selectedId);
    if(tap&&selected){
      if(target?.id===selected.id){this.clearSelection();this.refresh();return;}
      if(target&&selected.kind!=='shovel'){
        const outcome=MergeSystem.combine(selected,target);
        if(!outcome.ok||!outcome.unit||outcome.swap){this.selectedId=target.id;this.refresh();return;}
      }
      if(!target){
        const tile=hit.kind==='cell'?this.engine.state.grid[hit.row]?.[hit.col]:undefined;
        if(selected.kind==='shovel'?hit.kind==='cell'&&!['G','B'].includes(tile!):selected.location.zone==='board'||hit.kind==='cell'&&tile!=='O'){
          this.clearSelection();this.refresh();return;
        }
      }
    }
    if (this.selectedId && target?.id !== this.selectedId) {
      const location: UnitLocation = hit.kind === 'bench' ? { zone: 'bench', slot: hit.slot } : { zone: 'board', col: hit.col, row: hit.row };
      this.apply(this.engine.move(this.selectedId, location));
    } else if (target) {
      this.selectedId = target.id;
    } else { this.clearSelection(); }
    this.refresh();
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width * STAGE.width, y: (event.clientY - bounds.top) / bounds.height * STAGE.height };
  }

  private cancelDrag(): void {
    const previous = this.drag;
    this.drag = undefined;
    if (previous && this.canvas?.hasPointerCapture(previous.pointerId)) this.canvas.releasePointerCapture(previous.pointerId);
  }

  private cancelPropDrag(): void {
    const drag = this.propDrag; this.propDrag = undefined;
    if (drag&&this.root?.hasPointerCapture(drag.pointerId)) this.root.releasePointerCapture(drag.pointerId);
  }

  private bindEvents(): void {
    const unbindAudio=bindAudioGestures({unlock:()=>this.sound.unlock(),isUnlocked:()=>this.sound.isUnlocked?.()??false});
    this.root.addEventListener('pointerdown', event => {
      void this.sound.unlock().catch(() => undefined);
      const action=(event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      this.tutorialPointerAction=action==='tutorial-ack'||action==='tutorial-skip'?action:undefined;
      const target=event.target as HTMLElement;
      if(!this.dialog.open&&!this.drag&&target!==this.canvas&&!target.closest('button,input,select,textarea,a,dialog,canvas,#live-unit-card,.tutorial-bubble,#dev-tools,[data-target]')){this.clearSelection();this.refresh();}
    }, { passive: true });
    this.root.addEventListener('keydown', () => { void this.sound.unlock().catch(() => undefined); });
    this.root.addEventListener('input', event => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'range') this.profileScreens.change(event.target);
      if (event.target instanceof HTMLInputElement && event.target.dataset.endlessNickname !== undefined) this.boardDraft = event.target.value;
    });
    // Enter in the nickname field saves it instead of submitting (and navigating) the form.
    this.root.addEventListener('submit', event => {
      if (!(event.target instanceof HTMLFormElement) || event.target.dataset.endlessNameForm === undefined) return;
      event.preventDefault(); this.action('endless-name-save');
    });
    this.root.addEventListener('change', event => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) return;
      if(element.dataset.setting==='developerMode'){
        const enabled=(element as HTMLInputElement).checked;
        if(this.persistProfile(updateSettings(this.profile,{developerMode:enabled}))){
          if(!enabled){const url=new URL(location.href);url.searchParams.delete('dev');history.replaceState(null,'',url);}
          this.refresh(true);
        }else this.renderDialog();
        return;
      }
      if (element.id === 'dev-map') {
        this.devMapOverride = MAP_IDS.includes(element.value as MapId) ? element.value as MapId : undefined;
        this.refresh(true); return;
      }
      if (element.dataset.map !== undefined) this.devMapOverride = undefined;
      if (this.profileScreens.change(element)) return;
      if (this.meta.change(element)) return;
      if (element.dataset.propSlot) {
        const collect = (type: string) => [...this.root.querySelectorAll<HTMLSelectElement>(`[data-prop-slot^="${type}:"]`)].map(select => select.value).filter(Boolean);
        const result = setPropSlots(this.profile, collect('active'), collect('passive'));
        if (result.ok && saveProfile(result.profile)) this.acceptPersistedProfile(result.profile);
        else this.notify(result.ok ? 'hint.storage' : result.key, true);
        this.quickStamp = ''; this.refresh();
      }
    });
    this.root.addEventListener('pointerdown', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-prop-drag]');
      if (!button || !event.isPrimary || event.button !== 0 || (button as HTMLButtonElement).disabled || !this.canInteract()) return;
      event.preventDefault();
      const id = button.dataset.propDrag!;
      this.cancelDrag();
      this.propDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, id };
      this.root.setPointerCapture(event.pointerId);
    });
    this.root.addEventListener('dragstart',event=>{if((event.target as HTMLElement).closest('#battle-props'))event.preventDefault();});
    this.root.addEventListener('pointermove', event => {
      const drag = this.propDrag; if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
        event.preventDefault(); drag.moved = true; drag.point = this.point(event); this.selectedProp = drag.id; this.selectedId = undefined; this.shovelSelected = false;
      }
    });
    this.root.addEventListener('pointerup', event => {
      const drag = this.propDrag; if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const point = this.point(event);
      this.cancelPropDrag();
      if(!drag.moved){
        this.action(drag.id==='sprinkler'?'sprinkler':`prop:${drag.id}`);
      }else{
        this.selectedProp=undefined;
        const target=this.engine&&this.canInteract()?resolvePropDrop(this.engine.state,drag.id,point):null;
        if(target!==null)this.apply(drag.id==='sprinkler'?this.engine!.useSprinkler():this.engine!.useProp(drag.id,target));
      }
      this.suppressPropClick = true; setTimeout(() => { this.suppressPropClick = false; }, 0);
      this.refresh();
    });
    this.root.addEventListener('pointercancel', () => { this.tutorialPointerAction=undefined; if(this.propDrag)this.selectedProp=undefined;this.cancelPropDrag(); this.refresh(); });
    this.root.addEventListener('lostpointercapture', event => { if (this.propDrag?.pointerId === event.pointerId) { this.propDrag = undefined;this.selectedProp=undefined; this.refresh(); } });
    this.root.addEventListener('click', event => {
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-target]');
      if (!element || (element instanceof HTMLButtonElement && element.disabled)) return;
      event.preventDefault();
      if (element.dataset.target) {
        const [kind, first, second] = element.dataset.target.split(':');
        this.activate(kind === 'cell' ? { kind, col: Number(first), row: Number(second) } : kind === 'bench' ? { kind, slot: Number(first) } : { kind: 'shovel' },{fromKeyboard:true});
        return;
      }
      const action=element.dataset.action!;
      if(action==='tutorial-ack'||action==='tutorial-skip'){
        const origin=this.tutorialPointerAction;this.tutorialPointerAction=undefined;
        // A canvas release may move a fresh bubble beneath its compatibility click.
        // Keyboard activation has detail=0 and intentionally needs no pointer origin.
        if(event.detail>0&&origin!==action)return;
      }
      this.action(action);
    });
    this.canvas.addEventListener('pointerdown', event => {
      if (!this.canInteract() || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      const point = this.point(event);
      const hit = this.renderer.hitTest(point.x, point.y,{state:this.engine!.state,allowBenchLock:this.tutorialStep==='done'&&!this.selectedProp});
      if (!hit) { this.clearSelection(); this.refresh(); return; }
      const unit = this.unitAt(hit);
      this.drag = { pointerId: event.pointerId, start: point, point, id: unit?.id, shovel: hit.kind === 'shovel', moved: false };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.drag || this.drag.pointerId !== event.pointerId || !this.canInteract()) return;
      event.preventDefault();
      this.drag.point = this.point(event);
      if ((this.drag.id || this.drag.shovel) && Math.hypot(this.drag.point.x - this.drag.start.x, this.drag.point.y - this.drag.start.y) > 9) {
        this.drag.moved = true;
        this.selectedProp = undefined;
        this.selectedId = this.drag.id;
        this.shovelSelected = this.drag.shovel;
      }
    });
    this.canvas.addEventListener('pointerup', event => {
      const drag = this.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = this.point(event);
      const hit = this.renderer.hitTest(point.x, point.y,{state:this.engine!.state,allowBenchLock:this.tutorialStep==='done'&&!this.selectedProp,dragging:drag.moved});
      this.cancelDrag();
      if (!this.canInteract() || !hit) { if(!drag.moved)this.clearSelection();this.refresh(); return; }
      if (drag.moved) {
        this.selectedId = drag.id;
        this.shovelSelected = drag.shovel;
        if (hit.kind !== 'shovel' || this.engine?.state.units.some(unit => unit.id === drag.id && unit.kind === 'shovel' && unit.location.zone === 'bench')) this.activate(hit,{dragged:true});
      } else this.activate(hit);
      this.refresh();
    });
    this.canvas.addEventListener('pointercancel', () => { this.cancelDrag(); this.refresh(); });
    this.canvas.addEventListener('lostpointercapture', () => { this.drag = undefined; });
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (this.dialogKind === 'result'&&this.resultStatsOpen) this.action('close-result-stats');
      else if(this.dialogKind==='endless-offer')this.action('decline-endless');
      else if (this.dialogKind === 'pause') this.action('resume');
      else if (this.dialogKind === 'recipes') this.action('close-recipes');
      else if (this.dialogKind === 'armory' || this.dialogKind === 'market') this.action('close-meta');
      else if (this.dialogKind === 'kitchen') this.action('close-kitchen');
      else if (this.dialogKind === 'village') this.action('close-village');
      else if (this.dialogKind === 'profile' || this.dialogKind === 'leaderboard' || this.dialogKind === 'endless-board' || this.dialogKind === 'settings') this.action('close-profile');
      else if (this.dialogKind === 'medallions') this.action('close-medallions');
      else this.menu();
    });
    document.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'Escape' && !this.dialog.open) { this.clearSelection(); this.refresh(); }
      if (event.key.toLowerCase() === 'p' && !event.repeat && !this.dialog.open) this.pause();
      if (event.code === 'Space' && event.target === this.canvas && this.canInteract()) { event.preventDefault(); this.action('summon'); }
    });
    document.addEventListener('visibilitychange', () => { this.sound.setDucked(this.retainedPage || document.hidden || !!this.engine && this.engine.state.phase !== 'playing'); if (document.hidden) this.pause(); });
    window.addEventListener('pagehide', event => {
      if (event.persisted) { this.retainedPage = true; this.sound.setDucked(true); }
      else {unbindAudio();this.sound.dispose();}
    });
    window.addEventListener('pageshow', () => {
      this.retainedPage = false;
      this.sound.setDucked(document.hidden || !!this.engine && this.engine.state.phase !== 'playing');
    });
  }

  private action(action: string): void {
    if(!['summon','sprinkler','grant','boss','food','orange-plus','orange-minus','skip'].includes(action)&&!action.startsWith('prop:'))this.sound.play('ui_click');
    if (action === 'zh-CN' || action === 'en') { setLanguage(action); return; }
    if(action==='retry-save-result'){
      if(this.engine?.state.result){this.persistResult(this.engine.state);this.renderDialog();if(!this.savedResult)this.notify('hint.storage',true);}
      return;
    }
    if(action==='enter-endless'||action==='decline-endless'){
      if(this.dialogKind!=='endless-offer'||!this.engine)return;
      if(!this.savedResult||!this.profile.awardedBattles.includes(this.engine.state.id)){this.notify('p13.saveFirst',true);return;}
      if(action==='decline-endless'){this.showDialog('result');return;}
      const result=this.engine.enterEndless();
      if(result.ok){this.closeDialog(false);this.clearSelection();this.resultStatsOpen=false;this.waveStrategyStamp='';this.canvas.focus({preventScroll:true});this.refresh(true);}
      else this.apply(result);
      return;
    }
    if(action==='dismiss-early-tip'){this.markEarlyTipSeen();this.refresh();return;}
    if(action==='passive-backpack'){
      if(this.engine?.canSyncPreparationLoadout()){this.meta.open('market');this.meta.tab='backpack';this.openModal('market');}
      return;
    }
    if(action==='broth-info'){
      if(this.engine?.state.sides.player.loadout.activeBrothId){this.passiveInfoId=this.passiveInfoId==='broth'?undefined:'broth';this.renderPassives();}
      return;
    }
    if(action.startsWith('passive-info:')){
      const id=action.slice(13);
      if(this.engine?.state.sides.player.loadout.equippedPassiveProps.includes(id)){this.passiveInfoId=this.passiveInfoId===id?undefined:id;this.renderPassives();}
      return;
    }
    if(action==='toggle-result-stats'||action==='close-result-stats'){
      if(this.dialogKind!=='result')return;
      this.resultStatsOpen=action==='toggle-result-stats'&&!this.resultStatsOpen;
      this.renderDialog();
      this.dialog.querySelector<HTMLElement>(this.resultStatsOpen?'[data-action="close-result-stats"]':'.btn-stats')?.focus({preventScroll:true});
      return;
    }
    if(action==='early-wave'){
      if(this.canInteract()&&this.tutorialStep==='done'){const result=this.engine!.callEarlyWave();this.apply(result);if(result.ok)this.markEarlyTipSeen();this.refresh();}return;
    }
    if(action==='wave-preview'){this.notify('p6.previewDetail',false,{detail:wavePreviewTip(this.engine?.getUpcomingWavePreview()??null)});return;}
    if(action==='toggle-bench-lock'){
      const unit=this.engine?.state.units.find(u=>u.id===this.selectedId&&u.side==='player');
      if(this.canInteract()&&this.tutorialStep==='done'&&unit?.location.zone==='bench'){this.apply(this.engine!.toggleBenchLock(unit.location.slot));this.refresh();}return;
    }
    if(action.startsWith('book:')){
      const tab=action.slice(5);
      if(this.compendium.select(tab)){
        this.renderDialog();this.dialog.scrollTop=0;
        this.dialog.querySelector<HTMLElement>(`#book-tab-${tab}`)?.focus({preventScroll:true});
      }
      return;
    }
    if(action.startsWith('compendium-entry:')){
      if(this.compendium.inspectEntry(action.slice(17))){
        this.renderDialog();
        const body=this.dialog.querySelector<HTMLElement>('.ledger-body');if(body)body.scrollTop=0;
        this.dialog.querySelector<HTMLElement>('[data-action="compendium-back"]')?.focus({preventScroll:true});
      }
      return;
    }
    if(action==='compendium-back'){
      const previous=this.compendium.closeDetail();this.renderDialog();
      if(previous)this.dialog.querySelector<HTMLElement>(`[data-action="compendium-entry:${previous}"]`)?.focus();
      return;
    }
    if(action==='compendium-prev'||action==='compendium-next'){
      if(this.compendium.stepDetail(action==='compendium-prev'?-1:1)){
        this.renderDialog();this.dialog.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus({preventScroll:true});
      }
      return;
    }
    if(action==='compendium-awakened-toggle'){
      this.compendium.toggleAwakened();this.renderDialog();
      this.dialog.querySelector<HTMLElement>('[data-action="compendium-awakened-toggle"]')?.focus({preventScroll:true});
      return;
    }
    if(action==='tutorial-skip'||action==='tutorial-ack'){this.progressTutorial(action==='tutorial-skip'?'skip':'acknowledge');return;}
    if(action==='tutorial-replay'){
      if(!this.persistProfile(replayTutorial(this.profile)))return;
      this.start(true);return;
    }
    if (this.profileScreens.action(action)) return;
    if (action === 'profile' || action === 'leaderboard' || action === 'settings' || action === 'brand') { this.endlessHubMode = false; this.openProfileScreen(action === 'brand' ? 'profile' : action); return; }
    if (action === 'endless-board') { this.openProfileScreen('endless-board'); return; }
    if (action === 'close-profile') { this.closeProfileScreen(); return; }
    // P17 medallion hall owns a dedicated two-tab Endless window ([ Medallions | Global Board ]).
    if (action === 'medallions') { this.endlessHubMode = true; this.medallions.open(); this.openProfileScreen('medallions'); return; }
    if (action === 'close-medallions') { this.closeProfileScreen(); return; }
    if (action === 'endless-board-refresh') { this.refreshBoard(true); return; }
    if (action === 'rank-board-refresh') { this.syncRankScore(); this.refreshRankBoard(true); return; }
    if (action === 'location-request') {
      if (this.profile.locationMode === 'real' && !!this.profile.locationLabel) this.disableLocation();
      else void this.requestLocation(false);
      return;
    }
    if (action === 'endless-name-save') { void this.saveNickname(); return; }
    if (this.dialogKind === 'medallions' && this.medallions.action(action)) {
      const id = action.split(':')[1]; this.dialog.querySelector<HTMLElement>(`.medallion-row[data-medallion-id="${CSS.escape(id ?? '')}"] [data-action^="medallion-up"]`)?.focus({ preventScroll: true });
      return;
    }
    if (action === 'dismiss-rotate') { this.rotateDismissed = true; this.refresh(); return; }
    if (action === 'fullscreen') { void document.documentElement.requestFullscreen?.().catch(() => undefined); return; }
    if (action.startsWith('select-map:')) {
      const id=action.slice(11); if(id !== 'auto' && !MAP_IDS.includes(id as MapId))return;
      const next=selectMap(this.profile,id as MapId|'auto'); if(next!==this.profile)this.persistProfile(next); return;
    }
    if (action.startsWith('inspect-book:')) { this.compendium.openTo(action.slice(13)); this.openModal('recipes'); return; }
    if (action.startsWith('compendium-hero:')) { this.compendium.selectHero(action.slice(16)); this.renderDialog(); return; }
    if (action === 'store-shovel') { if(this.canInteract() && this.selectedId) this.apply(this.engine!.storeShovel(this.selectedId)); this.refresh(); return; }
    if (action === 'battle-shop' || action.startsWith('battle-shop:')) { const screen=action === 'battle-shop:armory'?'armory':'market'; this.meta.open(screen); this.openModal(screen); return; }
    const previousDish=action==='kitchen-back'?this.kitchen.detail:undefined;
    const previousWeapon=action==='meta-weapon-back'?this.dialog.querySelector<HTMLElement>('.storybook-detail-sheet')?.dataset.weaponId:undefined;
    if (this.meta.action(action)) {
      const focusAction=action.startsWith('meta-weapon:')?'meta-weapon-back':previousWeapon?`meta-weapon:${previousWeapon}`:undefined;
      if(focusAction){
        const target=this.dialog.querySelector<HTMLElement>(`[data-action="${CSS.escape(focusAction)}"]`);
        target?.focus({preventScroll:true});target?.scrollIntoView?.({block:'nearest'});
      }
      return;
    }
    if (action === 'armory' || action === 'market') { this.meta.open(action); this.openModal(action); return; }
    if (action === 'kitchen') { this.kitchen.open(); this.openModal('kitchen'); return; }
    if (action === 'village') { this.village.open(); this.openModal('village'); return; }
    if (action === 'close-village') { this.closeModal(); return; }
    if (this.dialogKind === 'village' && this.village.action(action)) {
      if (action.startsWith('village-focus:') || action.startsWith('village-build:')) {
        const row = this.dialog.querySelector<HTMLElement>(`.village-row[data-facility-id="${CSS.escape(action.split(':')[1])}"]`);
        row?.scrollIntoView?.({ block: 'nearest' });(row?.querySelector<HTMLElement>('button') ?? row)?.focus?.({ preventScroll: true });
      }
      return;
    }
    if (action === 'close-kitchen') { this.closeModal(); return; }
    if (this.dialogKind === 'kitchen' && this.kitchen.action(action)) {
      // Detail entry focuses its back button; returning restores focus to the dish row.
      const focusAction = action.startsWith('kitchen-dish:') ? 'kitchen-back' : action === 'kitchen-back' ? `kitchen-dish:${previousDish ?? ''}` : undefined;
      if (focusAction) { const target = this.dialog.querySelector<HTMLElement>(`.kitchen-row [data-action="${CSS.escape(focusAction)}"], .compendium-detail-bar [data-action="${CSS.escape(focusAction)}"]`); target?.focus({ preventScroll: true }); target?.scrollIntoView?.({ block: 'nearest' }); }
      if (action.startsWith('kitchen-tab:') || action.startsWith('kitchen-dish:') || action === 'kitchen-back') { const body = this.dialog.querySelector<HTMLElement>('.ledger-body'); if (body && action !== 'kitchen-back') body.scrollTop = 0; }
      return;
    }
    if (action === 'close-meta') { this.closeModal(); return; }
    if (action === 'test-enable' || action === 'test-restore') {
      const wasTestProfile = isTestProfile();
      const profile = action === 'test-enable' ? enableTestProfile() : restoreNormalProfile();
      const nowTestProfile = isTestProfile();
      const success = action === 'test-enable' ? nowTestProfile && profile.unlockedWeapons.length === 36 : !nowTestProfile;
      if (!success) { this.notify('hint.storage', true); return; }
      if (action === 'test-restore') this.devMapOverride = undefined;
      this.meta.reset();
      this.profile = profile;
      this.sound.setSettings(this.profile.settings);
      this.quickStamp = '';
      // A battle owns a snapshot of its profile's test/normal identity. Discard it
      // only after the profile transaction succeeds, before another frame can
      // record heroes or settle its rewards against a different identity.
      if (wasTestProfile !== nowTestProfile) this.menu();
      else this.refresh(true);
      this.notify(action === 'test-enable' ? 'm2.testReady' : 'm2.testRestored'); return;
    }
    if (action.startsWith('prop:')) {
      if (this.suppressPropClick || !this.canInteract() || !this.engine) return;
      const id = action.slice(5); const prop = PROPS[id]; if (!prop) return;
      if (prop.target === 'self') { this.selectedProp = undefined; this.apply(this.engine.useProp(id)); }
      else { this.selectedProp = this.selectedProp === id ? undefined : id; this.selectedId = undefined; this.shovelSelected = false; }
      this.refresh(); return;
    }
    if (action === 'sprinkler') { if (!this.suppressPropClick&&this.canInteract()) this.apply(this.engine!.useSprinkler()); return; }
    if (action === 'skip-transition') {this.endTransition();return;}
    if (action === 'start') { this.start(true); return; }
    if (action === 'menu') { this.menu(); return; }
    if (action === 'clear') { this.clearSelection(); this.refresh(); return; }
    if (action === 'pause') { this.pause(); return; }
    if (action === 'resume') { this.closeDialog(true); this.refresh(); this.canvas.focus({ preventScroll: true }); return; }
    if (action === 'recipes') { if(this.tutorialStep===5)this.progressTutorial('open-compendium');this.openModal('recipes'); return; }
    if (action === 'close-recipes') { this.closeModal(); return; }
    if (action === 'surrender') {
      if (this.engine?.state.phase === 'paused') { this.closeDialog(false); this.engine.surrender(); if (this.engine.state.result) this.finish(this.engine.state); }
      return;
    }
    if (action === 'reset') {
      const success = resetOwnStorage();
      if (!success) { this.notify('hint.storage', true); return; }
      this.meta.reset();
      this.devMapOverride = undefined;
      this.profile = emptyProfile();
      this.sound.setSettings(this.profile.settings);
      this.menu();
      setLanguage('zh-CN');
      this.notify(success ? 'hint.reset' : 'hint.storage', !success);
      return;
    }
    if (!this.canInteract() || !this.engine) return;
    if(action==='focus-hero-merge'){
      const options=getHeroMergeOptions(this.engine.state);
      if(options.length){const index=options.findIndex(o=>o.heroId===this.mergeLocatorHero),choice=options[(index+1)%options.length];this.clearSelection();this.selectedId=choice.sourceId;this.mergeLocatorHero=choice.heroId;}
      this.refresh();return;
    }
    if (action === 'summon') {
      const result = this.engine.summon();
      if (result.ok) { this.cancelDrag(); this.sound.play('summon'); this.progressTutorial('summon'); }
      this.apply(result);
      if(result.ok)this.clearSelection();
    }
    else if (action === 'food') { this.engine.addFood(500); this.notify('hint.foodAdded'); }
    else if (action === 'grant') this.apply(this.engine.grant(this.element<HTMLSelectElement>('dev-unit').value));
    else if (action === 'boss') this.apply(this.engine.spawnBoss(this.element<HTMLSelectElement>('dev-boss').value));
    else if (action === 'orange-plus' || action === 'orange-minus') { this.engine.adjustOranges(action === 'orange-plus' ? 1 : -1); this.notify(action === 'orange-plus' ? 'hint.orangeAdded' : 'hint.orangeLost'); }
    else if (action === 'skip') { this.engine.skipWave(); this.notify('hint.waveSkipped'); }
    else if (action === 'speed') this.speed = nextBattleSpeed(this.speed);
    else if (action === 'speed-1') this.speed = 1;
    else if (action === 'speed-2') this.speed = 2;
    else if (action === 'speed-3') this.speed = 3;
    this.refresh();
  }
}
