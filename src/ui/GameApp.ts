import { BattleEngine } from '../core/BattleEngine';
import type { BattleState, CommandResult, Interaction, MapId, Profile, Unit, UnitLocation } from '../core/types';
import { UNITS, BEE_PRODUCTION, ECONOMY, SHOVEL_PRODUCTION } from '../config/units';
import { HEROES } from '../config/heroes';
import { RECIPES } from '../config/recipes';
import { BOSS_IDS } from '../config/enemies';
import { MAP_IDS, STAGE } from '../config/maps';
import { FIRST_WAVE_PREPARATION, WAVES, WAVE_DURATION } from '../config/waves';
import { StickerRenderer } from '../render/StickerRenderer';
import { getLanguage, onLanguageChange, setLanguage, t } from '../i18n/i18n';
import { awardBattle, emptyProfile, loadProfile, resetOwnStorage, saveProfile, enableTestProfile, restoreNormalProfile, isTestProfile } from './storage';
import { MetaScreens, propSlots, type MetaScreen } from './MetaScreens';
import { PROPS } from '../config/props';
import { setPropSlots } from '../core/MetaProgression';
import './m2.css';
import './m3.css';
import './p1.css';
import { RANKS, getRank } from '../config/ranks';
import { recordMergedHeroes, resolveMap, updateSettings } from '../core/PlayerProgression';
import { ProfileScreens, rankCard, mapOptions, type ProfileScreen } from './ProfileScreens';
import { SoundManager } from './SoundManager';
import { capyIllustration, capyLogo, escapeHtml as esc } from './art';
import { onAssetsReady } from '../render/AssetRegistry';
import { avatarSticker } from '../render/M3Art';
import { propSticker, sceneSticker, unitSticker } from './stickers';
import { Compendium } from './Compendium';
import { getBossHUD, getWaveHUD, getMusicMode, isDeveloperMode } from './BattleHUD';
import { advanceTutorial, finishTutorial, replayTutorial, type TutorialAction, type TutorialStep } from '../core/Tutorial';
import { tutorialMarkup } from './TutorialView';

type Hit = { kind: 'cell'; col: number; row: number } | { kind: 'bench'; slot: number } | { kind: 'shovel' };
type DialogKind = 'pause' | 'recipes' | 'result' | MetaScreen | ProfileScreen;
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
  private resumeAfterRecipe = false;
  private speed: 1 | 2 = 1;
  private selectedId?: number;
  private shovelSelected = false;
  private selectedProp?: string;
  private propDrag?: { pointerId: number; startX: number; startY: number; moved: boolean; id: string; button: HTMLElement; point?: { x: number; y: number } };
  private suppressPropClick = false;
  private newWeapons: string[] = [];
  private meta: MetaScreens;
  private profileScreens: ProfileScreens;
  private sound = new SoundManager(this.profile.settings);
  private compendium = new Compendium();
  private tutorialStep: TutorialStep = 'done';
  private tutorialStamp = '';
  private opponentStamp = '';
  private bossStamp = '';
  private assetsDirty = false;
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
      this.profile = profile; this.sound.setSettings(profile.settings); this.quickStamp = ''; this.renderMenu();
    }, () => { if (this.dialogKind === 'armory' || this.dialogKind === 'market') this.renderDialog(); }, (key, error, vars) => this.notify(key, error, vars), cue => this.sound.play(cue));
    this.profileScreens = new ProfileScreens(() => this.profile, profile => this.persistProfile(profile), () => this.refresh(true), key => this.notify(key));
    this.root.innerHTML = this.shell();
    this.canvas = this.element<HTMLCanvasElement>('battle-canvas');
    this.dialog = this.element<HTMLDialogElement>('game-dialog');
    this.renderer = new StickerRenderer(this.canvas);
    this.bindEvents();
    onLanguageChange(() => this.refresh(true));
    onAssetsReady(() => { this.assetsDirty = true; });
    const narrow = matchMedia('(max-width: 1050px)');
    this.element<HTMLDetailsElement>('dev-tools').open = !narrow.matches;
    narrow.addEventListener('change', () => { this.element<HTMLDetailsElement>('dev-tools').open = !narrow.matches; });
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
              <div class="speed-control"><span data-i18n="dev.speed"></span><div class="segmented"><button type="button" data-action="speed-1" data-battle>1×</button><button type="button" data-action="speed-2" data-battle>2×</button></div></div>
              <div class="dev-live" id="dev-live"></div><p class="control-caption" id="dev-tip"></p>
              <section class="m2-dev"><strong id="profile-mode"></strong><button type="button" class="button button-peach" data-action="test-enable" data-i18n="m2.testEnable"></button><button type="button" class="button button-light" data-action="test-restore" data-i18n="m2.testRestore"></button><label for="dev-rank" data-i18n="m3.devRank"></label><select id="dev-rank"></select><label for="dev-map" data-i18n="m3.devMap"></label><select id="dev-map"></select><p data-i18n="m2.nextBattle"></p><div id="quick-loadout"></div></section>
              <div class="reset-control"><button type="button" class="text-button" data-action="reset" data-i18n="dev.reset"></button><p class="control-caption" data-i18n="dev.resetNote"></p></div>
            </div>
          </details>
          <div class="side-note"><span aria-hidden="true">✿</span><p data-i18n="guide.survival"></p></div>
        </aside>
        <section class="center-column">
          <div class="stage menu-mode" id="stage">
            <canvas id="battle-canvas" width="640" height="1386" tabindex="0" role="img"></canvas>
            <section class="menu-screen" id="menu-screen"></section>
            <div class="battle-hud" id="battle-hud" hidden>
              <div class="hud-topline"><div><span class="map-eyebrow" data-i18n="hud.map"></span><strong id="hud-wave"></strong></div><button type="button" class="icon-button" data-action="pause" data-label="hud.pause" id="pause-button"><span aria-hidden="true">Ⅱ</span></button></div>
              <div class="hud-resource-row"><div class="food-pill"><span aria-hidden="true">🥫</span><strong id="food-value">30</strong><span data-i18n="hud.food"></span></div><span class="time-chip" id="battle-clock"></span><button type="button" class="speed-pill" data-action="speed" data-label="hud.speedLabel" id="hud-speed">1×</button></div>
              <div id="wave-progress" class="wave-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i><span></span></div>
            </div>
            <div id="boss-banner" class="boss-banner" hidden></div><div id="opponent-banner" class="opponent-banner" hidden></div>
            <div class="battle-actions" id="battle-actions" hidden><button type="button" class="recipe-shortcut icon-button" data-action="recipes" data-label="recipe.open"><span aria-hidden="true">✦</span></button><button type="button" class="summon-button" data-action="summon" id="summon-button"><span aria-hidden="true" class="bell">♧</span><span class="summon-copy"><strong id="summon-title"></strong><small id="summon-note"></small><small id="summon-shortage" hidden></small></span><span aria-hidden="true">＋</span></button></div>
            <div id="battle-props" hidden></div><div id="sealed-hint" class="sealed-hint" hidden></div>
            <div id="tutorial-overlay" hidden></div>
          </div>
          <p class="stage-caption" data-i18n="guide.controls"></p>
        </section>
        <aside class="journal-column">
          <section class="paper-card guide-card"><span class="eyebrow" data-i18n="menu.new"></span><h2 data-i18n="guide.title"></h2><ol class="how-to"><li><b>01</b><div><h3 data-i18n="guide.step1"></h3><p data-i18n="guide.step1Body"></p></div></li><li><b>02</b><div><h3 data-i18n="guide.step2"></h3><p data-i18n="guide.step2Body"></p></div></li><li><b>03</b><div><h3 data-i18n="guide.step3"></h3><p data-i18n="guide.step3Body"></p></div></li></ol><div class="tiny-recipe"><span>🐼</span><b>+</b><span>🎋</span><b>=</b><span class="legend-sticker">🐼<i>✦</i></span></div><button type="button" class="text-button recipe-link" data-action="recipes" data-i18n="recipe.open"></button></section>
          <section class="paper-card inspect-card"><h2 data-i18n="inspect.title"></h2><div id="inspector"></div></section>
          <div class="tip-note"><span aria-hidden="true">☂</span><p data-i18n="guide.tip"></p></div>
          <details class="paper-card keyboard-card"><summary data-i18n="keyboard.title"></summary><p class="muted" data-i18n="keyboard.help"></p><div id="keyboard-controls"></div></details>
        </aside>
      </main>
      <footer class="page-footer"><span aria-hidden="true">✿</span> <span data-i18n="app.footer"></span></footer>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
      <dialog id="game-dialog" class="game-dialog"></dialog>
    </div>`;
  }

  start(): void {
    this.closeDialog(false);
    this.overlayReturn = null;
    this.engine = new BattleEngine({ mapId: this.devMapOverride ?? resolveMap(this.profile), rankIndex: getRank(this.profile.stars).index, loadouts: { player: structuredClone(this.profile) } });
    this.engine.start();
    this.tutorialStep = this.profile.tutorialCompleted ? 'done' : 1;
    this.tutorialStamp = ''; this.bossStamp = ''; this.opponentStamp = '';
    this.speed = 1;
    this.completedId = '';
    this.newWeapons = [];
    this.newAvatars = []; this.mergedStamp = '';
    this.battlePropsStamp = '';
    this.clearSelection();
    this.lastFrame = performance.now();
    this.refresh(true);
    this.canvas.focus({ preventScroll: true });
  }

  private menu(): void {
    this.closeDialog(false);
    this.overlayReturn = null;
    this.engine = null;
    this.tutorialStep = 'done'; this.tutorialStamp = '';
    this.clearSelection();
    this.refresh(true);
    this.root.querySelector<HTMLButtonElement>('[data-action="start"]')?.focus({ preventScroll: true });
  }

  private frame = (now: number): void => {
    const dt = Math.min(Math.max((now - this.lastFrame) / 1000, 0), 0.06);
    this.lastFrame = now;
    if (this.engine) {
      this.engine.tick(dt * this.speed);
      const state = this.engine.state;
      this.sound.setMode(getMusicMode(state,!!this.dialogKind));
      this.sound.consumeBattle(state);
      this.sound.setDucked(this.retainedPage || document.hidden || state.phase !== 'playing');
      const merged = state.mergedHeroes.player;
      const mergedStamp = merged.join(',');
      if (mergedStamp !== this.mergedStamp) {
        this.mergedStamp = mergedStamp;
        const next = recordMergedHeroes(this.profile, merged);
        if (JSON.stringify(next) !== JSON.stringify(this.profile)) this.persistProfile(next);
      }
      if (this.selectedId && !state.units.some(unit => unit.id === this.selectedId && unit.side === 'player')) this.selectedId = undefined;
      if (state.phase === 'finished' && this.completedId !== state.id) this.finish(state);
      const interaction: Interaction = { selectedId: this.selectedId, shovel: this.shovelSelected, propId: this.selectedProp, showDamageNumbers: this.profile.settings.showDamageNumbers };
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
      this.renderer.draw(state, state.time, interaction);
    } else { this.sound.setMode('menu'); this.sound.setDucked(this.retainedPage || document.hidden); }
    if (now - this.lastRefresh > 120) { this.refresh(); this.lastRefresh = now; }
    requestAnimationFrame(this.frame);
  };

  private finish(state: BattleState): void {
    this.completedId = state.id;
    this.clearSelection();
    if (state.result) {
      const before = this.profile;
      this.previousRank = getRank(before.stars).index;
      const award = awardBattle(this.profile, state.id, state.result);
      this.savedResult = !award.awarded || saveProfile(award.profile);
      if (this.savedResult) {
        this.profile = award.profile;
        this.newWeapons = award.newWeapons;
        this.newAvatars = this.profile.unlockedAvatars.filter(id => !before.unlockedAvatars.includes(id));
      }
      this.resultStars = this.profile.stars - before.stars;
      this.sound.play(state.result.winner === 'player' ? 'victory' : 'defeat');
    }
    this.showDialog('result');
    this.refresh(true);
  }

  private refresh(force = false): void {
    const state = this.engine?.state;
    const active = state?.phase === 'playing';
    if(this.assetsDirty && !this.drag && !this.propDrag) {
      this.assetsDirty=false; force=true;
      this.quickStamp=''; this.battlePropsStamp=''; this.opponentStamp=''; this.bossStamp='';
      this.root.querySelector('.brand-mark')!.innerHTML=sceneSticker('logo_capy',capyLogo,54);
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
    this.canvas.hidden = !state;
    this.element('battle-props').hidden = !state;
    this.renderBattleHUD();
    this.renderTutorial();
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
    this.element<HTMLButtonElement>('hud-speed').disabled = !active;
    this.element<HTMLButtonElement>('pause-button').disabled = state?.phase !== 'playing';
    if (state) {
      this.root.querySelector<HTMLElement>('.map-eyebrow')!.textContent = t(`map.${state.mapId}`);
      const player = state.sides.player;
      const remaining = state.units.filter(unit => unit.side === 'player' && unit.location.zone === 'bench').length;
      const shortage = Math.max(0, Math.ceil(ECONOMY.summonCost - player.food));
      const summonTitle = t(remaining > 0 ? 'hud.redraw' : 'hud.summon');
      const summonNote = t(remaining > 0 ? 'hud.redrawCost' : 'hud.cost', { remaining, cost: ECONOMY.summonCost, count: ECONOMY.summonCount });
      this.element('hud-wave').textContent = t('hud.wave', { wave: Math.max(1, state.wave), total: WAVES.length });
      this.element('food-value').textContent = String(Math.floor(player.food));
      this.element('battle-clock').textContent = clock(state.time);
      this.element('battle-clock').setAttribute('aria-label', `${t('hud.time')} ${clock(state.time)}`);
      this.element('summon-title').textContent = summonTitle;
      this.element('summon-note').textContent = summonNote;
      this.element('summon-shortage').hidden = shortage === 0;
      this.element('summon-shortage').textContent = t('hud.noFood', { count: shortage });
      // An occupied bench can be replaced. Low-food clicks explain that the current pack is retained.
      this.element<HTMLButtonElement>('summon-button').disabled = !active;
      this.element('summon-button').classList.toggle('unaffordable', shortage > 0);
      this.element('summon-button').setAttribute('aria-label', `${summonTitle}. ${summonNote}${shortage ? `. ${t('hud.noFood', { count: shortage })}` : ''}`);
    }
    // Keep the canvas fixed in the viewport while a pointer is captured. Replacing
    // a tall hero inspector with the short shovel card can otherwise clamp page
    // scroll and move the board underneath the finger before pointerup.
    if (!this.drag && !this.propDrag) {
      this.renderInspector();
      this.renderKeyboard();
    }
    const toast = this.element('toast');
    toast.hidden = !this.toast || performance.now() > this.toast.until;
    if (this.toast) {
      const message = t(this.toast.key, this.toast.vars);
      if (toast.textContent !== message) toast.textContent = message;
      toast.classList.toggle('toast-error', this.toast.error);
    }
  }

  private updateSelect(id: string, ids: readonly string[], label: (id: string) => string): void {
    const select = this.element<HTMLSelectElement>(id);
    const previous = select.value;
    select.innerHTML = ids.map(value => `<option value="${esc(value)}">${esc(label(value))}</option>`).join('');
    if (ids.includes(previous)) select.value = previous;
  }

  private renderMenu(): void {
    this.element('menu-screen').innerHTML = `<div class="menu-top"><span class="menu-chip"><i></i>${tr('menu.eyebrow')}</span><span class="doodle-star" aria-hidden="true">✳</span></div><h1>${tr('menu.title').replace(/\n/g, '<br>')}</h1><p class="menu-subtitle">${tr('menu.subtitle').replace(/\n/g, '<br>')}</p><div class="hero-illustration">${sceneSticker('menu_banner',capyIllustration)}<span class="illustration-caption">${tr('render.keepCalm')} ✦</span></div><button type="button" class="button start-button" data-action="start"><span>${tr('menu.start')}</span><span aria-hidden="true">↗</span></button><p class="duration">${tr('menu.duration', { waves: WAVES.length, preparation: FIRST_WAVE_PREPARATION })}</p><div class="menu-stats"><span><strong>${this.profile.coins}</strong><small>${tr('profile.coins')}</small></span><span><strong>${this.profile.wins}</strong><small>${tr('profile.wins')}</small></span><span><strong>${Object.values(this.profile.weaponFragments).reduce((sum, amount) => sum + amount, 0)}</strong><small>${tr('profile.fragments')}</small></span></div><p class="profile-history">${tr('menu.record', { count: this.profile.matches })}</p><button type="button" class="text-button menu-recipe-link" data-action="recipes">${tr('menu.recipes')} <span aria-hidden="true">→</span></button>`;
    this.element('menu-screen').querySelector('.menu-stats')!.insertAdjacentHTML('beforebegin', `<div class="meta-menu"><button type="button" class="button button-light" data-action="armory">⚔ ${tr('m2.armory')} <small>${this.profile.unlockedWeapons.length}/36</small></button><button type="button" class="button button-peach" data-action="market">🦝 ${tr('m2.market')} ${this.profile.freeLotteryTickets ? `<b class="ticket-badge">🎟 ${this.profile.freeLotteryTickets}</b>` : ''}</button></div>`);
    this.element('menu-screen').querySelector('.start-button')!.insertAdjacentHTML('beforebegin', `${rankCard(this.profile)}<label class="map-select" for="menu-map"><span>${tr('m3.map')}</span><select id="menu-map" data-map>${mapOptions(this.profile)}</select><small>${tr('m3.mapRule')}</small></label>`);
    this.element('menu-screen').querySelector('.meta-menu')!.insertAdjacentHTML('beforeend', `<button type="button" class="button button-light" data-action="leaderboard">♛ ${tr('m3.leaderboard')}</button>`);
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
      return `<button type="button" class="battle-prop prop-${slot} ${id === this.selectedProp ? 'selected' : ''}" data-action="prop:${id ?? ''}" ${prop ? `data-prop-drag="${id}"` : ''} aria-label="${esc(name)}${prop ? `. ${esc(status)}. ${tr(`prop.${id}.desc`)}` : ''}" title="${prop ? tr(`prop.${id}.desc`) : esc(name)}"${!prop || !active || cooldown ? ' disabled' : ''}><span>${prop ? propSticker(id,36) : '+'}</span><small>${esc(name)}</small>${cooldown ? `<b>${cooldown}s</b>` : ''}</button>`;
    }).join('');
    this.element('battle-props').innerHTML = `<button type="button" class="sprinkler-button" data-action="sprinkler" title="${tr('m2.sprinklerDesc')}" aria-label="${tr('m2.sprinkler')}. ${tr(player.sprinklerUsed ? 'm2.sprinklerUsed' : 'm2.sprinklerReady')}"${!active || player.sprinklerUsed ? ' disabled' : ''}><span>${sceneSticker('sprinkler',propSticker('washer',32),32)}</span><small>${tr('p1.sprinklerShort')}</small><b>${player.sprinklerUsed ? '0' : '1'}</b></button>${slots}<div class="passive-icons">${player.loadout.equippedPassiveProps.map(id => `<span title="${tr(`prop.${id}`)}: ${tr(`prop.${id}.desc`)}" aria-label="${tr(`prop.${id}`)}">${propSticker(id,24)}</span>`).join('')}</div>${this.selectedProp ? `<p class="prop-target-hint" role="status">${tr(PROPS[this.selectedProp].target === 'road' ? 'm2.targetRoad' : 'm2.targetUnit')}</p>` : ''}`;
  }

  private renderBattleHUD(): void {
    const state=this.engine?.state, banner=this.element('boss-banner'), opponent=this.element('opponent-banner');
    if(!state){banner.hidden=true;opponent.hidden=true;return;}
    const wave=getWaveHUD(state), progress=this.element('wave-progress');
    progress.dataset.kind=wave.kind;
    progress.setAttribute('aria-valuenow',String(Math.round(wave.fraction*100)));
    progress.setAttribute('aria-label',t(wave.kind==='preparation'?'p1.prepare':'p1.waveProgress',{time:wave.remaining}));
    progress.querySelector<HTMLElement>('i')!.style.width=`${wave.fraction*100}%`;
    progress.querySelector('span')!.textContent=wave.kind==='preparation'?t('p1.prepare',{time:wave.remaining}):'';
    const identity=state.opponent;
    opponent.hidden=!identity;
    if(identity){
      const stamp=`${getLanguage()}:${identity.id}:${identity.rankIndex}`;
      if(stamp!==this.opponentStamp){
        this.opponentStamp=stamp;
        opponent.innerHTML=`${avatarSticker(identity.avatarId,32)}<span><b>${esc(identity.name[getLanguage()])}</b><small>${tr(`rank.${identity.rankIndex}`)}</small></span>`;
        opponent.setAttribute('aria-label',`${t('p1.opponent')}: ${identity.name[getLanguage()]}, ${t(`rank.${identity.rankIndex}`)}`);
      }
    }
    const boss=getBossHUD(state);
    banner.hidden=!boss;
    if(!boss){this.bossStamp='';return;}
    const stamp=`${getLanguage()}:${boss.id}:${boss.count}`;
    if(stamp!==this.bossStamp){
      this.bossStamp=stamp;
      banner.innerHTML=`<div class="boss-portrait">${unitSticker(boss.kind,40)}</div><div class="boss-detail"><div class="boss-heading"><strong>${tr(`boss.${boss.kind}`)}${boss.count>1?` ×${boss.count}`:''}</strong><small class="boss-numbers"></small></div><div class="boss-hp" role="progressbar" aria-valuemin="0"><i></i></div><div class="boss-skill"><i></i><span></span></div></div>`;
    }
    banner.classList.toggle('skill-warning',boss.warning);
    banner.querySelector('.boss-numbers')!.textContent=`${boss.hp} / ${boss.maxHp}`;
    const hp=banner.querySelector<HTMLElement>('.boss-hp')!;
    hp.setAttribute('aria-valuemax',String(boss.maxHp));hp.setAttribute('aria-valuenow',String(boss.hp));
    hp.setAttribute('aria-label',t('p1.bossHP',{hp:boss.hp,max:boss.maxHp}));
    hp.querySelector<HTMLElement>('i')!.style.width=`${boss.fraction*100}%`;
    banner.querySelector<HTMLElement>('.boss-skill i')!.style.width=`${(1-boss.cooldownFraction)*100}%`;
    banner.querySelector('.boss-skill span')!.textContent=t(boss.warning?'p1.bossSoon':'p1.bossCooldown',{time:boss.cooldown});
  }

  private renderTutorial():void {
    const state=this.engine?.state, overlay=this.element('tutorial-overlay');
    overlay.hidden=!state||state.phase!=='playing'||this.tutorialStep==='done';
    if(overlay.hidden||!state)return;
    const stamp=JSON.stringify([this.tutorialStep,getLanguage(),this.selectedId,state.units.find(unit=>unit.id===this.selectedId)?.location]);
    if(stamp===this.tutorialStamp)return;
    this.tutorialStamp=stamp;
    overlay.innerHTML=tutorialMarkup(this.tutorialStep,state,this.selectedId);
  }

  private progressTutorial(action:TutorialAction):void {
    if(this.tutorialStep==='done')return;
    const next=advanceTutorial(this.tutorialStep,action);
    if(next==='done'){
      const result=finishTutorial(this.profile,action!=='skip');
      if(!this.persistProfile(result.profile))return;
      this.tutorialStep='done';this.tutorialStamp='';
      this.notify(action==='skip'?'p1.tutorialSkipped':result.awarded?'p1.tutorialReward':'p1.tutorialDone');
    }else {this.tutorialStep=next;this.refresh();}
  }

  private renderInspector(): void {
    const state = this.engine?.state;
    const player = state?.sides.player;
    const unit = state?.units.find(item => item.id === this.selectedId && item.side === 'player');
    const unitStats = unit && this.engine!.getUnitStats(unit);
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
      const name = unit ? `${unitName(unit.kind)} · ${t('inspect.level', { level: unit.level })}` : t('keyboard.empty');
      return `<button type="button" class="key-cell ${unit?.id === this.selectedId ? 'key-selected' : ''}" data-target="bench:${slot}" aria-label="${tr('keyboard.bench', { slot: slot + 1, name })}" title="${esc(name)}"${disabled}>${unit ? icon(unit.kind) : slot + 1}</button>`;
    }).join('');
    const cells: string[] = [];
    for (let row = 5; row < 10; row++) for (let col = 0; col < 8; col++) {
      const unit = this.unitAt({ kind: 'cell', col, row });
      const tile = state.grid[row][col];
      const name = unit ? `${unitName(unit.kind)} · ${t('inspect.level', { level: unit.level })}` : t(`tile.${tile}`);
      cells.push(`<button type="button" class="key-cell tile-${tile} ${unit?.id === this.selectedId ? 'key-selected' : ''}" data-target="cell:${col}:${row}" aria-label="${tr('keyboard.cell', { row: row + 1, col: col + 1, name })}" title="${esc(name)}"${disabled}>${unit ? icon(unit.kind) : tile === 'G' ? '·' : tile === 'O' ? '+' : tile === 'B' ? '×' : tile === 'C' ? '♨' : tile === 'S' ? '↗' : '—'}</button>`);
    }
    container.innerHTML = `<div class="keyboard-nests">${nests}</div><button type="button" class="button button-light keyboard-shovel ${this.shovelSelected ? 'key-selected' : ''}" data-target="shovel"${disabled}>${tr('hud.shovel', { count: state.sides.player.shovels })}</button><div class="keyboard-grid">${cells.join('')}</div>`;
    if (oldFocus) container.querySelector<HTMLButtonElement>(`[data-target="${oldFocus}"]`)?.focus({ preventScroll: true });
  }

  private lootMarkup(loot: string[]): string {
    if (!loot.length) return `<p class="loot-empty">${tr('loot.none')}</p>`;
    const counts = new Map<string, number>();
    loot.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    return `<ul class="loot-list">${[...counts].map(([id, count]) => `<li><span aria-hidden="true">✦</span><span>${tr(`fragment.${id}`)}</span><b>×${count}</b></li>`).join('')}</ul>`;
  }

  private showDialog(kind: DialogKind): void {
    this.dialogKind = kind;
    this.renderDialog();
    if (!this.dialog.open) this.dialog.showModal();
  }

  private renderDialog(): void {
    const kind = this.dialogKind;
    this.dialog.classList.toggle('recipe-dialog', kind === 'recipes');
    this.dialog.classList.toggle('meta-dialog', kind === 'armory' || kind === 'market');
    this.dialog.classList.toggle('profile-dialog', kind === 'profile' || kind === 'leaderboard');
    this.dialog.setAttribute('aria-labelledby', 'dialog-title');
    if (kind === 'profile' || kind === 'leaderboard' || kind === 'settings') {
      this.dialog.innerHTML = this.profileScreens.markup(kind);
      if(kind==='settings')this.dialog.querySelector<HTMLInputElement>('[data-setting="developerMode"]')!.checked=isDeveloperMode(location.search,this.profile.settings);
    } else if (kind === 'armory' || kind === 'market') {
      this.dialog.innerHTML = this.meta.markup(kind);
    } else if (kind === 'pause' && this.engine) {
      this.dialog.innerHTML = `<div class="dialog-decoration" aria-hidden="true">♨</div><span class="eyebrow">${tr('pause.eyebrow')}</span><h2 id="dialog-title">${tr('pause.title')}</h2><p class="dialog-subtitle">${tr('pause.subtitle')}</p><h3>${tr('pause.loot')}</h3><div class="loot-columns"><section><h4>${tr('loot.you')}</h4>${this.lootMarkup(this.engine.state.sides.player.loot)}</section><section><h4>${tr('loot.ai')}</h4>${this.lootMarkup(this.engine.state.sides.ai.loot)}</section></div><p class="dialog-rule">${tr('pause.rule')}</p><button type="button" class="button button-teal" data-action="resume" autofocus>${tr('pause.keep')}</button><button type="button" class="text-button surrender-button" data-action="surrender">${tr('pause.surrender')}</button>`;
    } else if (kind === 'recipes') {
      this.dialog.innerHTML = this.compendium.markup(this.profile);
    } else if (kind === 'result' && this.engine?.state.result) {
      const result = this.engine.state.result;
      const won = result.winner === 'player';
      this.dialog.innerHTML = `<div class="result-sticker" aria-hidden="true">${won ? '🍊' : '☁'}</div><span class="eyebrow">${tr('result.time', { time: clock(result.elapsed) })}</span><h2 id="dialog-title">${tr(won ? 'result.win' : 'result.loss')}</h2><p class="dialog-subtitle">${tr(won ? 'result.winSub' : 'result.lossSub')}</p><p class="result-reason">${tr(`result.reason.${result.reason}`)}</p><div class="result-rewards"><span><b>+${won ? result.coins : 0}</b><small>${tr('profile.coins')}</small></span><span><b>+${won ? result.loot.length : 0}</b><small>${tr('profile.fragments')}</small></span></div><h3>${tr('result.pool')}</h3>${this.lootMarkup(result.loot)}<p class="save-note">${tr(this.savedResult ? 'result.awarded' : 'result.memory')}</p><button type="button" class="button button-teal" data-action="start" autofocus>${tr('result.again')}</button><button type="button" class="text-button back-menu" data-action="menu">${tr('result.menu')}</button>`;
    }
    if (kind === 'pause') this.dialog.insertAdjacentHTML('beforeend', `<div class="meta-tabs"><button type="button" data-action="profile">${tr('m3.profile')}</button><button type="button" data-action="settings">${tr('m3.settings')}</button></div>`);
    if (kind === 'result' && this.engine?.state.result?.winner === 'player') this.dialog.insertAdjacentHTML('beforeend', `<p class="ticket-reward">🎟 ${tr('m2.freeTicket')}</p>${this.newWeapons.length ? `<section class="unlock-reward"><h3>✦ ${tr('m2.newWeapons')}</h3>${this.newWeapons.map(id => `<p>${tr(`weapon.${id}`)}</p>`).join('')}</section>` : ''}`);
    if (kind === 'result' && this.engine?.state.result) {
      const rank = getRank(this.profile.stars), won = this.engine.state.result.winner === 'player';
      this.dialog.querySelector('.result-rewards')?.insertAdjacentHTML('afterend', `<section class="rank-result" role="status"><strong>${tr('m3.starChange', { change: this.resultStars > 0 ? `+${this.resultStars}` : this.resultStars, stars: this.profile.stars })}</strong>${this.savedResult && !won && this.resultStars === 0 ? `<p>${tr(this.previousRank < 10 ? 'm3.protected' : 'm3.floorProtected')}</p>` : ''}${won && this.resultStars > 1 ? `<p>${tr('m3.streakBonus')}</p>` : ''}${rank.index > this.previousRank ? `<h3>${tr('m3.promotion', { rank: t(`rank.${rank.index}`) })}</h3>` : ''}${this.newAvatars.length ? `<h3>${tr('m3.newAvatars')}</h3>${this.newAvatars.map(id => `<p>${tr(`avatar.${id}`)}</p>`).join('')}` : ''}</section>`);
    }
    if (kind) this.dialog.insertAdjacentHTML('afterbegin', `<div class="language-switch dialog-language" role="group" aria-label="${tr('app.language')}"><button type="button" data-action="zh-CN" class="${getLanguage() === 'zh-CN' ? 'selected' : ''}" aria-pressed="${getLanguage() === 'zh-CN'}">中</button><button type="button" data-action="en" class="${getLanguage() === 'en' ? 'selected' : ''}" aria-pressed="${getLanguage() === 'en'}">EN</button></div>`);
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
    this.profile = profile;
    this.sound.setSettings(profile.settings);
    this.quickStamp = '';
    this.renderMenu();
    if (unlocked) this.notify('m3.newAvatars');
    return true;
  }

  private openProfileScreen(screen: ProfileScreen): void {
    if (!this.overlayReturn) {
      this.overlayReturn = { dialog: this.dialogKind, resume: this.canInteract() };
      if (this.canInteract()) this.engine!.pause(true);
    }
    this.cancelDrag(); this.cancelPropDrag();
    this.showDialog(screen); this.refresh();
  }

  private closeProfileScreen(): void {
    const previous = this.overlayReturn;
    this.overlayReturn = null;
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

  private apply(result: CommandResult): void {
    if (result.ok && (result.key === 'hint.dig' || result.key === 'hint.repaired')) this.sound.play('shovel');
    if (result.ok && result.key === 'hint.merged' && result.unitId && this.engine?.state.units.some(unit => unit.id === result.unitId && !!HEROES[unit.kind] && unit.level === 1)) this.sound.play('merge_hero');
    if (result.ok && result.unitId) {
      this.selectedId = result.unitId;
      this.shovelSelected = false;
    }
    this.notify(result.key, !result.ok);
    if(result.ok){
      if(result.key==='hint.dig'||result.key==='hint.repaired')this.progressTutorial('dig');
      if(result.key==='hint.deployed'&&this.engine?.state.units.some(unit=>unit.id===result.unitId&&unit.side==='player'&&unit.location.zone==='board'))this.progressTutorial('deploy');
      if(result.key==='hint.merged'||result.key==='hint.fed')this.progressTutorial('merge');
    }
  }

  private canInteract(): boolean { return this.engine?.state.phase === 'playing'; }

  private clearSelection(): void { this.selectedId = undefined; this.shovelSelected = false; this.selectedProp = undefined; this.cancelDrag(); this.cancelPropDrag(); }

  private unitAt(hit: Hit): Unit | undefined {
    return this.engine?.state.units.find(unit => unit.side === 'player' && (hit.kind === 'bench'
      ? unit.location.zone === 'bench' && unit.location.slot === hit.slot
      : hit.kind === 'cell' && unit.location.zone === 'board' && unit.location.col === hit.col && unit.location.row === hit.row));
  }

  private activate(hit: Hit): void {
    if (!this.canInteract() || !this.engine) return;
    if (this.selectedProp) {
      const prop = PROPS[this.selectedProp];
      const unit = this.unitAt(hit);
      const result = this.engine.useProp(this.selectedProp, prop.target === 'road' && hit.kind === 'cell' ? { col: hit.col, row: hit.row } : { unitId: unit?.id });
      if (result.ok) this.selectedProp = undefined;
      this.apply(result); this.refresh(); return;
    }
    if (hit.kind === 'shovel') {
      this.shovelSelected = !this.shovelSelected;
      this.selectedId = undefined;
      this.refresh();
      return;
    }
    if (this.shovelSelected) {
      if (hit.kind === 'cell') {
        this.apply(this.engine.dig(hit.col, hit.row));
        if (this.engine.state.sides.player.shovels === 0) this.shovelSelected = false;
      }
      this.refresh();
      return;
    }
    const target = this.unitAt(hit);
    if (this.selectedId && target?.id !== this.selectedId) {
      const location: UnitLocation = hit.kind === 'bench' ? { zone: 'bench', slot: hit.slot } : { zone: 'board', col: hit.col, row: hit.row };
      this.apply(this.engine.move(this.selectedId, location));
    } else if (target) {
      this.selectedId = target.id;
      this.notify('hint.selected', false, { name: unitName(target.kind) });
    } else if (hit.kind === 'cell' && hit.row < 5) this.notify('hint.enemyTerritory', true);
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
    if (drag?.button.hasPointerCapture(drag.pointerId)) drag.button.releasePointerCapture(drag.pointerId);
  }

  private bindEvents(): void {
    this.root.addEventListener('pointerdown', () => { void this.sound.unlock().catch(() => undefined); }, { passive: true });
    this.root.addEventListener('keydown', () => { void this.sound.unlock().catch(() => undefined); });
    this.root.addEventListener('input', event => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'range') this.profileScreens.change(event.target);
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
        if (result.ok && saveProfile(result.profile)) this.profile = result.profile;
        else this.notify(result.ok ? 'hint.storage' : result.key, true);
        this.quickStamp = ''; this.refresh();
      }
    });
    this.root.addEventListener('pointerdown', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-prop-drag]');
      if (!button || !event.isPrimary || event.button !== 0 || (button as HTMLButtonElement).disabled || !this.canInteract()) return;
      const id = button.dataset.propDrag!;
      this.propDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, id, button };
      button.setPointerCapture(event.pointerId);
    });
    this.root.addEventListener('pointermove', event => {
      const drag = this.propDrag; if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
        event.preventDefault(); drag.moved = true; drag.point = this.point(event); this.selectedProp = drag.id; this.selectedId = undefined; this.shovelSelected = false;
      }
    });
    this.root.addEventListener('pointerup', event => {
      const drag = this.propDrag; if (!drag || drag.pointerId !== event.pointerId) return;
      const point = this.point(event); const hit = this.renderer.hitTest(point.x, point.y);
      this.cancelPropDrag();
      if (!drag.moved) return;
      this.suppressPropClick = true; setTimeout(() => { this.suppressPropClick = false; }, 0);
      this.selectedProp = drag.id;
      const bounds = this.canvas.getBoundingClientRect();
      if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom && this.canInteract()) {
        if (PROPS[drag.id].target === 'self') { const result = this.engine!.useProp(drag.id); if (result.ok) this.selectedProp = undefined; this.apply(result); }
        else if (hit) this.activate(hit);
      }
      this.refresh();
    });
    this.root.addEventListener('pointercancel', () => { this.cancelPropDrag(); this.refresh(); });
    this.root.addEventListener('lostpointercapture', event => { if (this.propDrag?.pointerId === event.pointerId) { this.propDrag = undefined; this.refresh(); } });
    this.root.addEventListener('click', event => {
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-target]');
      if (!element || (element instanceof HTMLButtonElement && element.disabled)) return;
      event.preventDefault();
      if (element.dataset.target) {
        const [kind, first, second] = element.dataset.target.split(':');
        this.activate(kind === 'cell' ? { kind, col: Number(first), row: Number(second) } : kind === 'bench' ? { kind, slot: Number(first) } : { kind: 'shovel' });
        return;
      }
      this.action(element.dataset.action!);
    });
    this.canvas.addEventListener('pointerdown', event => {
      if (!this.canInteract() || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      const point = this.point(event);
      const hit = this.renderer.hitTest(point.x, point.y);
      if (!hit) return;
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
        this.selectedId = this.drag.id;
        this.shovelSelected = this.drag.shovel;
      }
    });
    this.canvas.addEventListener('pointerup', event => {
      const drag = this.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = this.point(event);
      const hit = this.renderer.hitTest(point.x, point.y);
      this.cancelDrag();
      if (!this.canInteract() || !hit) { this.refresh(); return; }
      if (drag.moved) {
        this.selectedId = drag.id;
        this.shovelSelected = drag.shovel;
        if (hit.kind !== 'shovel') this.activate(hit);
      } else this.activate(hit);
      this.refresh();
    });
    this.canvas.addEventListener('pointercancel', () => { this.cancelDrag(); this.refresh(); });
    this.canvas.addEventListener('lostpointercapture', () => { this.drag = undefined; });
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (this.dialogKind === 'pause') this.action('resume');
      else if (this.dialogKind === 'recipes') this.action('close-recipes');
      else if (this.dialogKind === 'armory' || this.dialogKind === 'market') this.action('close-meta');
      else if (this.dialogKind === 'profile' || this.dialogKind === 'leaderboard' || this.dialogKind === 'settings') this.action('close-profile');
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
      else this.sound.dispose();
    });
    window.addEventListener('pageshow', () => {
      this.retainedPage = false;
      this.sound.setDucked(document.hidden || !!this.engine && this.engine.state.phase !== 'playing');
    });
  }

  private action(action: string): void {
    if(!['summon','sprinkler','grant','boss','food','orange-plus','orange-minus','skip'].includes(action)&&!action.startsWith('prop:'))this.sound.play('ui_click');
    if (action === 'zh-CN' || action === 'en') { setLanguage(action); return; }
    if(action.startsWith('book:')){if(this.compendium.select(action.slice(5)))this.renderDialog();return;}
    if(action==='tutorial-skip'||action==='tutorial-ack'){this.progressTutorial(action==='tutorial-skip'?'skip':'acknowledge');return;}
    if(action==='tutorial-replay'){
      if(!this.persistProfile(replayTutorial(this.profile)))return;
      if(this.engine&&this.engine.state.phase!=='finished'){
        this.tutorialStep=1;this.tutorialStamp='';this.closeProfileScreen();
      }else this.notify('p1.tutorialReplayReady');
      this.refresh();return;
    }
    if (this.profileScreens.action(action)) return;
    if (action === 'profile' || action === 'leaderboard' || action === 'settings' || action === 'brand') { this.openProfileScreen(action === 'brand' ? 'profile' : action); return; }
    if (action === 'close-profile') { this.closeProfileScreen(); return; }
    if (this.meta.action(action)) return;
    if (action === 'armory' || action === 'market') { this.meta.open(action); this.showDialog(action); return; }
    if (action === 'close-meta') { this.closeDialog(false); this.refresh(true); return; }
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
    if (action === 'sprinkler') { if (this.canInteract()) this.apply(this.engine!.useSprinkler()); return; }
    if (action === 'start') { this.start(); return; }
    if (action === 'menu') { this.menu(); return; }
    if (action === 'clear') { this.clearSelection(); this.refresh(); return; }
    if (action === 'pause') { this.pause(); return; }
    if (action === 'resume') { this.closeDialog(true); this.refresh(); this.canvas.focus({ preventScroll: true }); return; }
    if (action === 'recipes') {
      this.resumeAfterRecipe = this.canInteract();
      if (this.resumeAfterRecipe) this.engine!.pause(true);
      this.cancelDrag();
      this.showDialog('recipes');
      this.refresh();
      return;
    }
    if (action === 'close-recipes') { this.closeDialog(this.resumeAfterRecipe); this.resumeAfterRecipe = false; this.refresh(); return; }
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
    if (action === 'summon') {
      const result = this.engine.summon();
      if (result.ok) { this.cancelDrag(); this.sound.play('summon'); this.progressTutorial('summon'); }
      this.apply(result);
    }
    else if (action === 'food') { this.engine.addFood(500); this.notify('hint.foodAdded'); }
    else if (action === 'grant') this.apply(this.engine.grant(this.element<HTMLSelectElement>('dev-unit').value));
    else if (action === 'boss') this.apply(this.engine.spawnBoss(this.element<HTMLSelectElement>('dev-boss').value));
    else if (action === 'orange-plus' || action === 'orange-minus') { this.engine.adjustOranges(action === 'orange-plus' ? 1 : -1); this.notify(action === 'orange-plus' ? 'hint.orangeAdded' : 'hint.orangeLost'); }
    else if (action === 'skip') { this.engine.skipWave(); this.notify('hint.waveSkipped'); }
    else if (action === 'speed') this.speed = this.speed === 1 ? 2 : 1;
    else if (action === 'speed-1') this.speed = 1;
    else if (action === 'speed-2') this.speed = 2;
    this.refresh();
  }
}
