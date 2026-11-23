import { BattleEngine } from '../core/BattleEngine';
import { HEROES } from '../config/heroes';
import { getRank } from '../config/ranks';
import { STAGE } from '../config/maps';
import { ECONOMY } from '../config/units';
import {
  isFeatureUnlocked,
  maxBattleSpeed,
  type FeatureId,
} from '../core/FeatureUnlocks';
import {
  getMapUnlockRequirement,
  pickBattleMap,
  resolveMap,
  selectMap,
  updateSettings,
} from '../core/PlayerProgression';
import { propTargetKind, resolvePropDrop } from '../core/PropTargets';
import { advanceTutorial, finishTutorial, replayTutorial, type TutorialStep } from '../core/Tutorial';
import type { BattleState, MapId, Profile, Unit, UnitLocation } from '../core/types';
import { getLanguage, setLanguage, t } from '../i18n/i18n';
import { StickerRenderer, type HitTarget } from '../render/StickerRenderer';
import { nextBattleSpeed } from '../ui/P13HUD';
import { awardBattle, awardEndless, loadProfile, saveProfile } from '../ui/storage';
import type { PlatformAdapter, TouchEventData, ViewportMetrics } from '../platform/types';
import { MinigameAssetManager } from './MinigameAssetManager';
import { BattleAudioBridge } from './BattleAudioBridge';
import {
  ScrollRegion,
  UiHitManager,
  drawToast,
  type ToastMessage,
  type UiHitBox,
} from './ui/CanvasUI';
import { drawMenuScreen } from './ui/MenuScreen';
import { drawBattleOverlay } from './ui/BattleOverlay';
import {
  drawActiveModal,
  type MinigameModalKind,
  type ModalLayoutInfo,
  type SettlementMeta,
} from './ui/BattleModals';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  unitId?: number;
  shovel: boolean;
  propId?: string;
  moved: boolean;
}

/**
 * Phase 2 complete playable mini-game host on `PlatformAdapter` (`wx` / `bl` / `web` preview).
 * Renders Courtyard Menu, Full Battle HUD, Active/Passive Props, Live Unit Card,
 * Match-1 Tutorial, Pause, Endless Offer, Settlement, Quick Recipes & Settings purely on Canvas.
 */
export class MinigameApp {
  private readonly renderer: StickerRenderer;
  private readonly assetManager: MinigameAssetManager;
  private readonly audioBridge = new BattleAudioBridge();
  private readonly hits = new UiHitManager();
  private readonly scroll = new ScrollRegion();

  private profile: Profile;
  private engine: BattleEngine | null = null;
  private screen: 'menu' | 'battle' = 'menu';
  private modal: MinigameModalKind = null;
  private modalLayout: ModalLayoutInfo = {};
  private recipesTab: 'heroes' | 'basics' = 'heroes';
  private draggingSlider: 'music' | 'sound' | null = null;
  private scrollingModal = false;
  private activeTouchId: number | null = null;

  private rafId = 0;
  private lastTs = 0;
  private elapsedSec = 0;
  private speed: 1 | 2 | 3 = 1;
  private muted = false;
  private selectedId?: number;
  private shovelSelected = false;
  private activePropId?: string;
  private expandedPassiveId?: string;
  private tutorialStep: TutorialStep = 'done';
  private drag?: DragState;
  private toast: ToastMessage | null = null;
  private settlement: SettlementMeta = {
    savedResult: true,
    resultStars: 0,
    previousRank: 0,
    newWeapons: [],
    ticketAwarded: false,
    statsOpen: false,
  };
  private disposed = false;

  constructor(private readonly platform: PlatformAdapter) {
    this.profile = loadProfile(platform.storage);
    this.platform.audio.setSettings(this.profile.settings);
    this.muted = this.profile.settings.musicVolume <= 0 && this.profile.settings.soundVolume <= 0;
    this.renderer = new StickerRenderer(platform.canvas, { managedViewport: true });
    this.syncViewport(platform.viewport());
    this.assetManager = new MinigameAssetManager(platform);
    void this.assetManager.bootMainAssets();

    platform.onResize(vp => this.syncViewport(vp));
    platform.onHide(() => {
      if (this.screen === 'battle' && this.engine?.state.phase === 'playing') {
        this.engine.pause(true);
        if (!this.modal) this.modal = 'pause';
      }
    });
    platform.onTouch({
      start: p => this.onTouchStart(p),
      move: p => this.onTouchMove(p),
      end: p => this.onTouchEnd(p),
      cancel: () => this.resetPointerState(),
    });

    this.lastTs = platform.now();
    this.rafId = platform.requestFrame(ts => this.loop(ts));
  }

  /** Exposed read-only snapshot for automated QA and unit tests. */
  getDebugState() {
    return {
      screen: this.screen,
      modal: this.modal,
      tutorialStep: this.tutorialStep,
      speed: this.speed,
      profile: this.profile,
      battleState: this.engine?.state ?? null,
    };
  }

  private syncViewport(vp: ViewportMetrics): void {
    this.renderer.setViewportTransform(vp.stageScale, vp.stageOffsetX, vp.stageOffsetY);
  }

  /** Reserves space on top-right in wx/bl if the right pillarbox doesn't already clear WeChat's floating capsule. */
  private capsuleRightMargin(): number {
    if (this.platform.kind === 'web') return 18;
    const vp = this.platform.viewport();
    const rightLetterboxCss = Math.max(0, vp.screenWidth - (vp.stageCssX + vp.stageCssWidth));
    if (rightLetterboxCss >= 104) return 18;
    return Math.max(18, Math.round((108 - rightLetterboxCss) / Math.max(0.25, vp.stageCssWidth / STAGE.width)));
  }

  private showToast(text: string, tone: 'info' | 'good' | 'warn' = 'info', duration = 2.4): void {
    this.toast = { text, tone, remaining: duration, duration };
  }

  private loop(ts: number): void {
    if (this.disposed) return;
    const rawDt = Math.max(0, Math.min(0.1, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    this.elapsedSec += rawDt;

    if (this.toast) {
      this.toast.remaining -= rawDt;
      if (this.toast.remaining <= 0) this.toast = null;
    }
    this.scroll.tick(rawDt);

    if (this.screen === 'battle' && this.engine && this.engine.state.phase === 'playing' && !this.modal) {
      this.engine.tick(rawDt * this.speed);
      this.audioBridge.observe(this.engine.state, this.platform.audio, ts);
      if (this.engine.state.result) {
        this.handleBattleFinished(this.engine.state);
      }
    }

    this.drawFrame();
    this.rafId = this.platform.requestFrame(nextTs => this.loop(nextTs));
  }

  private handleBattleFinished(state: BattleState): void {
    const result = state.result;
    if (!result) return;

    if (result.endless) {
      const receipt = `${state.id}:endless`;
      if (!this.profile.awardedBattles.includes(receipt)) {
        const res = awardEndless(this.profile, state.id, result);
        if (res.awarded) {
          this.profile = res.profile;
          this.settlement.savedResult = saveProfile(this.profile, this.platform.storage);
          this.settlement.newWeapons = [...this.settlement.newWeapons, ...res.newWeapons];
          this.platform.audio.play('victory');
        }
      }
      this.modal = 'result';
      return;
    }

    if (!this.profile.awardedBattles.includes(state.id)) {
      const prevStars = this.profile.stars;
      const prevRank = getRank(prevStars).index;
      const res = awardBattle(this.profile, state.id, result);
      if (res.awarded) {
        this.profile = res.profile;
        const saved = saveProfile(this.profile, this.platform.storage);
        this.settlement = {
          savedResult: saved,
          resultStars: this.profile.stars - prevStars,
          previousRank: prevRank,
          newWeapons: res.newWeapons,
          ticketAwarded: Boolean(res.ticketAwarded),
          statsOpen: false,
        };
        this.platform.audio.play(result.winner === 'player' ? 'victory' : 'defeat');
      }
    }

    // Standard Wave-10 win: offer Endless Mode if player has unlocked Endless (10★+)!
    if (
      result.winner === 'player' &&
      result.reason === 'waves' &&
      !state.endless &&
      isFeatureUnlocked(this.profile, 'endless')
    ) {
      this.modal = 'endless-offer';
    } else {
      this.modal = 'result';
    }
  }

  private drawFrame(): void {
    const vp = this.platform.viewport();
    const c = this.platform.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#231d18';
    c.fillRect(0, 0, this.platform.canvas.width, this.platform.canvas.height);
    c.restore();

    this.hits.clear();
    c.save();
    c.setTransform(vp.stageScale, 0, 0, vp.stageScale, vp.stageOffsetX, vp.stageOffsetY);
    c.beginPath();
    c.rect(0, 0, STAGE.width, STAGE.height);
    c.clip();

    if (this.screen === 'menu' || !this.engine) {
      const mapId = resolveMap(this.profile);
      this.renderer.drawPreview(mapId, this.elapsedSec, 3);
      drawMenuScreen(c, this.hits, {
        profile: this.profile,
        elapsed: this.elapsedSec,
        muted: this.muted,
        capsuleRightMargin: this.capsuleRightMargin(),
      });
    } else {
      const state = this.engine.state;
      const breakthroughChances = state.endless ? this.computeBreakthroughChances(state) : undefined;
      this.renderer.draw(state, this.elapsedSec, {
        draggingId: this.drag?.moved ? this.drag.unitId : undefined,
        pointer: this.drag?.moved ? { x: this.drag.x, y: this.drag.y } : undefined,
        shovel: this.shovelSelected || (this.drag?.moved && this.drag.shovel),
        selectedId: this.selectedId,
        propId: this.activePropId ?? (this.drag?.moved ? this.drag.propId : undefined),
        showDamageNumbers: this.profile.settings.showDamageNumbers,
        allowBenchLock: true,
        breakthroughChances,
      });
      drawBattleOverlay(c, this.hits, {
        engine: this.engine,
        profile: this.profile,
        elapsed: this.elapsedSec,
        speed: this.speed,
        selectedId: this.selectedId,
        shovelSelected: this.shovelSelected,
        activePropId: this.activePropId,
        expandedPassiveId: this.expandedPassiveId,
        tutorialStep: this.tutorialStep,
        capsuleRightMargin: this.capsuleRightMargin(),
      });
    }

    if (this.modal) {
      // Modals sit strictly on top of background UI hits
      this.hits.clear();
      this.modalLayout = drawActiveModal(c, this.hits, {
        modal: this.modal,
        profile: this.profile,
        state: this.engine?.state ?? null,
        settlement: this.settlement,
        recipesTab: this.recipesTab,
        scroll: this.scroll,
      });
    } else {
      this.modalLayout = {};
    }

    drawToast(c, this.toast, STAGE.width, this.screen === 'battle' ? 68 : 82);
    c.restore();
  }

  private computeBreakthroughChances(state: BattleState): Record<number, number> {
    if (!this.engine) return {};
    const out: Record<number, number> = {};
    for (const u of state.units) {
      if (u.side === 'player' && HEROES[u.kind] && u.level >= 5 && !u.awakened) {
        out[u.id] = this.engine.getBreakthroughChance(u).total;
      }
    }
    return out;
  }

  private async startBattle(): Promise<void> {
    const map = pickBattleMap(this.profile);
    await this.assetManager.ensureMap(map.id);
    this.assetManager.releaseHeavyIdleSprites(map.id);

    const guided = !this.profile.tutorialCompleted;
    const bestStars = Math.max(this.profile.stars, this.profile.highestStars);
    this.engine = new BattleEngine({
      mapId: map.id,
      rankIndex: getRank(this.profile.stars).index,
      loadouts: { player: this.profile },
      unlockedWeapons: this.profile.unlockedWeapons,
      progressionStars: bestStars,
      progressionHeroes: this.profile.mergedHeroes,
      tutorialGuided: guided,
      featureDrops: {
        armory: isFeatureUnlocked(this.profile, 'armory'),
        village: isFeatureUnlocked(this.profile, 'village'),
        kitchen: isFeatureUnlocked(this.profile, 'kitchen'),
        medallions: isFeatureUnlocked(this.profile, 'medallions'),
      },
    });
    this.engine.start();
    this.audioBridge.reset(this.engine.state.id);

    this.tutorialStep = guided ? 1 : 'done';
    if (guided) this.engine.setTutorialHold(true);

    const maxSpd = maxBattleSpeed(this.profile);
    if (this.speed > maxSpd) this.speed = maxSpd;

    this.screen = 'battle';
    this.modal = null;
    this.selectedId = undefined;
    this.shovelSelected = false;
    this.activePropId = undefined;
    this.expandedPassiveId = undefined;
    this.drag = undefined;
    this.platform.audio.play('wave_start');
  }

  private advanceBattleTutorial(action: Parameters<typeof advanceTutorial>[1]): void {
    if (this.tutorialStep === 'done') return;
    const prev = this.tutorialStep;
    const next = advanceTutorial(prev, action);
    if (next === prev) return;
    this.tutorialStep = next;
    if (next === 6 || next === 'done') {
      this.engine?.setTutorialHold(false);
    }
    if (next === 'done') {
      const done = finishTutorial(this.profile, action !== 'skip');
      this.profile = done.profile;
      saveProfile(this.profile, this.platform.storage);
      if (done.awarded) {
        this.showToast(
          getLanguage() === 'zh-CN' ? '🎉 教学完成！获得 20 金币奖励！' : '🎉 Tutorial complete! +20 coins!',
          'good',
          3,
        );
      }
    }
  }

  private resetPointerState(): void {
    this.hits.activeId = null;
    this.activeTouchId = null;
    this.drag = undefined;
    this.draggingSlider = null;
    this.scrollingModal = false;
  }

  private onTouchStart(p: TouchEventData): void {
    this.activeTouchId = p.id;
    const hit = this.hits.hit(p.stageX, p.stageY);

    // 1. Active Modal touch handling (scroll, sliders, buttons)
    if (this.modal) {
      if (hit?.id === 'settings:music') {
        this.draggingSlider = 'music';
        this.updateVolumeSlider('music', p.stageX);
        return;
      }
      if (hit?.id === 'settings:sound') {
        this.draggingSlider = 'sound';
        this.updateVolumeSlider('sound', p.stageX);
        return;
      }
      const sv = this.modalLayout.scrollViewport;
      if (sv && p.stageX >= sv.x && p.stageX <= sv.x + sv.w && p.stageY >= sv.y && p.stageY <= sv.y + sv.h) {
        this.scrollingModal = true;
        this.scroll.onStart(p.stageY);
      }
      this.hits.activeId = hit?.id ?? null;
      return;
    }

    // 2. Active Prop button drag-to-cast support (left rail)
    if (hit && hit.id.startsWith('battle:prop:') && this.engine?.state.phase === 'playing') {
      const propId = String(hit.data ?? hit.id.slice('battle:prop:'.length));
      this.hits.activeId = hit.id;
      this.drag = {
        pointerId: p.id,
        startX: p.stageX,
        startY: p.stageY,
        x: p.stageX,
        y: p.stageY,
        shovel: false,
        propId,
        moved: false,
      };
      return;
    }

    // 3. Standard UI button hit
    if (hit) {
      this.hits.activeId = hit.id;
      return;
    }

    // 4. Battle Board / Bench / Shovel interaction
    if (this.screen !== 'battle' || !this.engine || this.engine.state.phase !== 'playing') return;
    this.expandedPassiveId = undefined;

    // If an active prop is currently armed by tap, try casting at this tap location
    if (this.activePropId) {
      this.tryCastActivePropAt(this.activePropId, { x: p.stageX, y: p.stageY });
      return;
    }

    const boardHit = this.renderer.hitTest(p.stageX, p.stageY, {
      state: this.engine.state,
      allowBenchLock: true,
      touch: p.pointerType === 'touch',
    });
    if (!boardHit) {
      this.selectedId = undefined;
      this.shovelSelected = false;
      return;
    }
    const unit = this.unitAt(boardHit);
    this.drag = {
      pointerId: p.id,
      startX: p.stageX,
      startY: p.stageY,
      x: p.stageX,
      y: p.stageY,
      unitId: unit?.id,
      shovel: boardHit.kind === 'shovel',
      moved: false,
    };
  }

  private onTouchMove(p: TouchEventData): void {
    if (this.activeTouchId !== null && p.id !== this.activeTouchId) return;

    if (this.draggingSlider) {
      this.updateVolumeSlider(this.draggingSlider, p.stageX);
      return;
    }
    if (this.scrollingModal) {
      this.scroll.onMove(p.stageY);
      if (this.scroll.movedDistance > 10) this.hits.activeId = null;
      return;
    }
    if (!this.drag || this.drag.pointerId !== p.id) return;

    this.drag.x = p.stageX;
    this.drag.y = p.stageY;
    if ((this.drag.unitId || this.drag.shovel || this.drag.propId) && Math.hypot(p.stageX - this.drag.startX, p.stageY - this.drag.startY) > 9) {
      this.drag.moved = true;
      this.hits.activeId = null;
      if (this.drag.propId) {
        this.activePropId = this.drag.propId;
        this.selectedId = undefined;
        this.shovelSelected = false;
      } else {
        this.selectedId = this.drag.unitId;
        this.shovelSelected = this.drag.shovel;
      }
    }
  }

  private onTouchEnd(p: TouchEventData): void {
    if (this.activeTouchId !== null && p.id !== this.activeTouchId) return;
    this.activeTouchId = null;

    if (this.draggingSlider) {
      this.draggingSlider = null;
      saveProfile(this.profile, this.platform.storage);
      return;
    }

    if (this.scrollingModal) {
      const wasScroll = this.scroll.onEnd();
      this.scrollingModal = false;
      if (wasScroll) { this.hits.activeId = null; return; }
    }

    // Active Prop drag release
    if (this.drag?.propId) {
      const propId = this.drag.propId;
      const moved = this.drag.moved;
      this.drag = undefined;
      this.hits.activeId = null;
      if (moved) {
        this.tryCastActivePropAt(propId, { x: p.stageX, y: p.stageY });
      } else {
        this.handleActivePropTap(propId);
      }
      return;
    }

    // UI button tap release
    const pressedId = this.hits.activeId;
    this.hits.activeId = null;
    if (pressedId) {
      const releaseHit = this.hits.hit(p.stageX, p.stageY);
      if (releaseHit && releaseHit.id === pressedId) {
        this.handleUiAction(releaseHit);
      }
      return;
    }

    // Battle Board / Bench / Shovel release
    const drag = this.drag;
    if (!drag || drag.pointerId !== p.id) return;
    this.drag = undefined;
    if (!this.engine || this.engine.state.phase !== 'playing') return;

    const hit = this.renderer.hitTest(p.stageX, p.stageY, {
      state: this.engine.state,
      allowBenchLock: true,
      dragging: drag.moved,
      touch: p.pointerType === 'touch',
    });
    if (!hit) {
      if (!drag.moved) { this.selectedId = undefined; this.shovelSelected = false; }
      return;
    }
    this.handleBoardTapOrDrop(hit, drag.moved);
  }

  private updateVolumeSlider(which: 'music' | 'sound', stageX: number): void {
    const rect = which === 'music' ? this.modalLayout.musicSlider : this.modalLayout.soundSlider;
    if (!rect) return;
    const v = Math.max(0, Math.min(1, (stageX - rect.x) / rect.w));
    const rounded = Math.round(v * 20) / 20;
    this.profile = updateSettings(this.profile, which === 'music' ? { musicVolume: rounded } : { soundVolume: rounded });
    this.muted = this.profile.settings.musicVolume <= 0 && this.profile.settings.soundVolume <= 0;
    this.platform.audio.setSettings(this.profile.settings);
  }

  private handleActivePropTap(propId: string): void {
    if (!this.engine || this.engine.state.phase !== 'playing') return;
    const kind = propTargetKind(propId);
    if (kind === 'self') {
      const res = this.engine.useProp(propId, {});
      if (res.ok) {
        this.platform.audio.play('prop_use');
        this.activePropId = undefined;
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    // Toggle target-selection mode for unit/road props
    this.platform.audio.play('click');
    this.activePropId = this.activePropId === propId ? undefined : propId;
    this.selectedId = undefined;
    this.shovelSelected = false;
  }

  private tryCastActivePropAt(propId: string, point: { x: number; y: number }): void {
    if (!this.engine || this.engine.state.phase !== 'playing') {
      this.activePropId = undefined;
      return;
    }
    const target = resolvePropDrop(this.engine.state, propId, point);
    if (!target) {
      this.activePropId = undefined;
      return;
    }
    const res = this.engine.useProp(propId, target);
    if (res.ok) {
      this.platform.audio.play('prop_use');
      this.activePropId = undefined;
    } else {
      this.showToast(t(res.key), 'warn', 1.8);
      this.activePropId = undefined;
    }
  }

  private handleUiAction(box: UiHitBox): void {
    const id = box.id;
    const lang = getLanguage();

    // Backdrop dismiss for non-mandatory modals
    if (id === 'modal:backdrop') {
      if (this.modal === 'pause') this.resumeBattle();
      else if (this.modal === 'recipes' || this.modal === 'settings') this.closeOverlayModal();
      return;
    }
    if (id === 'modal:card' || id === 'battle:card-bg' || id === 'battle:tutorial-bg') return;

    this.platform.audio.play('click');

    // ── Menu Actions ────────────────────────────────────────────────────────
    if (id === 'menu:start') {
      void this.startBattle();
      return;
    }
    if (id === 'menu:lang' || id === 'settings:lang') {
      setLanguage(lang === 'zh-CN' ? 'en' : 'zh-CN');
      return;
    }
    if (id === 'menu:mute') {
      this.muted = !this.muted;
      this.profile = updateSettings(this.profile, this.muted
        ? { musicVolume: 0, soundVolume: 0 }
        : { musicVolume: 0.5, soundVolume: 0.75 });
      this.platform.audio.setSettings(this.profile.settings);
      saveProfile(this.profile, this.platform.storage);
      return;
    }
    if (id === 'menu:settings' || id === 'modal:open-settings') {
      this.modal = 'settings';
      return;
    }
    if (id === 'menu:recipes') {
      this.scroll.reset();
      this.modal = 'recipes';
      return;
    }
    if (id === 'menu:profile') {
      const rank = getRank(this.profile.stars);
      this.showToast(`${t(`rank.${rank.index}`)} · ★${this.profile.stars} · ${this.profile.wins}/${this.profile.matches}`, 'info', 2.4);
      return;
    }
    if (id.startsWith('menu:map:')) {
      const data = box.data as { id: 'auto' | MapId; locked: boolean; reqStars: number } | undefined;
      if (!data) return;
      if (data.locked) {
        const req = getMapUnlockRequirement(data.id as MapId);
        const need = Math.max(1, req.minStars - Math.max(this.profile.stars, this.profile.highestStars));
        this.showToast(t('p19.mapUnlockToast', {
          map: t(`map.${data.id}`),
          stars: req.minStars,
          rank: t(`rank.${req.rankIndex}`),
          need,
        }), 'warn', 2.6);
      } else {
        this.profile = selectMap(this.profile, data.id);
        saveProfile(this.profile, this.platform.storage);
        if (data.id !== 'auto') void this.assetManager.ensureMap(data.id);
      }
      return;
    }
    if (id.startsWith('menu:locked:')) {
      const feat = id.slice('menu:locked:'.length) as FeatureId;
      const best = Math.max(this.profile.stars, this.profile.highestStars);
      const starsMap: Record<FeatureId, number> = { armory: 1, speed2x: 2, market: 5, endless: 10, village: 16, kitchen: 23, medallions: 32, speed3x: 60 };
      const req = starsMap[feat] ?? 1;
      if (feat === 'armory' && (this.profile.matches ?? 0) === 0) {
        this.showToast(t('p19.lockedMatchToast', { name: t(`p19.feature.${feat}`) }), 'warn', 2.6);
      } else {
        this.showToast(t('p19.lockedToast', { name: t(`p19.feature.${feat}`), stars: req, need: Math.max(1, req - best) }), 'warn', 2.6);
      }
      return;
    }
    if (id.startsWith('menu:hub:')) {
      const hub = id.slice('menu:hub:'.length);
      this.showToast(
        lang === 'zh-CN'
          ? `✨「${hub === 'leaderboard' ? t('p5.page.leaderboard') : t(`p19.feature.${hub}`)}」已解锁！完整养成界面将在阶段 3 上线`
          : `✨ ${hub === 'leaderboard' ? t('p5.page.leaderboard') : t(`p19.feature.${hub}`)} unlocked! Full Canvas hub arrives in Phase 3.`,
        'good',
        2.6,
      );
      return;
    }

    // ── Battle HUD Actions ──────────────────────────────────────────────────
    if (id === 'battle:speed') {
      const maxSpd = maxBattleSpeed(this.profile);
      if (maxSpd <= 1) {
        const need = Math.max(1, 2 - Math.max(this.profile.stars, this.profile.highestStars));
        this.showToast(t('p19.lockedToast', { name: t('p19.feature.speed2x'), stars: 2, need }), 'warn', 2.2);
      } else {
        this.speed = nextBattleSpeed(this.speed, maxSpd);
      }
      return;
    }
    if (id === 'battle:guide') {
      this.scroll.reset();
      if (this.engine?.state.phase === 'playing') this.engine.pause(true);
      this.modal = 'recipes';
      this.advanceBattleTutorial('open-compendium');
      return;
    }
    if (id === 'battle:pause') {
      if (this.engine?.state.phase === 'playing') this.engine.pause(true);
      this.modal = 'pause';
      return;
    }
    if (id === 'battle:early-wave' && this.engine?.state.phase === 'playing') {
      const res = this.engine.callEarlyWave();
      if (res.ok) {
        this.platform.audio.play('wave_start');
        this.showToast(t('p6.earlyCalled'), 'good', 2.0);
      }
      return;
    }
    if (id === 'battle:sprinkler' && this.engine?.state.phase === 'playing') {
      const res = this.engine.useSprinkler();
      if (res.ok) this.platform.audio.play('sprinkler');
      else this.showToast(t(res.key), 'warn', 1.8);
      return;
    }
    if (id === 'battle:summon' && this.engine?.state.phase === 'playing') {
      const res = this.engine.summon();
      if (res.ok) {
        this.platform.audio.play('summon');
        this.selectedId = undefined;
        this.activePropId = undefined;
        this.advanceBattleTutorial('summon');
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id === 'battle:cancel-mode') {
      this.activePropId = undefined;
      this.shovelSelected = false;
      return;
    }
    if (id === 'battle:clear-select') {
      this.selectedId = undefined;
      return;
    }
    if (id === 'battle:lock-selected' && this.engine && this.selectedId !== undefined) {
      const u = this.engine.state.units.find(x => x.id === this.selectedId);
      if (u && u.location.zone === 'bench') {
        const res = this.engine.toggleBenchLock(u.location.slot);
        if (res.ok) this.showToast(t(res.key), 'info', 1.8);
      }
      return;
    }
    if (id === 'battle:store-shovel' && this.engine && this.selectedId !== undefined) {
      const res = this.engine.storeShovel(this.selectedId);
      if (res.ok) {
        this.platform.audio.play('shovel');
        this.selectedId = undefined;
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id.startsWith('battle:passive:')) {
      const pid = id.slice('battle:passive:'.length);
      this.expandedPassiveId = this.expandedPassiveId === pid ? undefined : pid;
      return;
    }
    if (id === 'battle:tutorial-skip') {
      this.advanceBattleTutorial('skip');
      return;
    }
    if (id === 'battle:tutorial-ack') {
      this.advanceBattleTutorial('acknowledge');
      return;
    }

    // ── Modal Actions ───────────────────────────────────────────────────────
    if (id === 'modal:resume') {
      this.resumeBattle();
      return;
    }
    if (id === 'modal:close') {
      this.closeOverlayModal();
      return;
    }
    if (id === 'modal:surrender' && this.engine) {
      this.modal = null;
      this.engine.surrender();
      if (this.engine.state.result) this.handleBattleFinished(this.engine.state);
      return;
    }
    if (id === 'modal:decline-endless') {
      this.modal = 'result';
      return;
    }
    if (id === 'modal:enter-endless' && this.engine) {
      const res = this.engine.enterEndless();
      if (res.ok) {
        this.modal = null;
        this.platform.audio.play('wave_start');
        this.showToast(lang === 'zh-CN' ? '♾️ 无尽模式开启！第 11 波来袭！' : '♾️ Endless Mode started! Wave 11!', 'good', 2.6);
      }
      return;
    }
    if (id === 'modal:toggle-stats') {
      this.settlement.statsOpen = !this.settlement.statsOpen;
      return;
    }
    if (id === 'modal:again') {
      this.modal = null;
      void this.startBattle();
      return;
    }
    if (id === 'modal:menu') {
      this.returnToMenu();
      return;
    }
    if (id === 'modal:recipes-tab:heroes') {
      this.recipesTab = 'heroes';
      this.scroll.reset();
      return;
    }
    if (id === 'modal:recipes-tab:basics') {
      this.recipesTab = 'basics';
      this.scroll.reset();
      return;
    }
    if (id === 'settings:damage') {
      this.profile = updateSettings(this.profile, { showDamageNumbers: !this.profile.settings.showDamageNumbers });
      saveProfile(this.profile, this.platform.storage);
      return;
    }
    if (id === 'settings:replay-tutorial') {
      this.profile = replayTutorial(this.profile);
      saveProfile(this.profile, this.platform.storage);
      this.modal = null;
      void this.startBattle();
    }
  }

  private resumeBattle(): void {
    this.modal = null;
    if (this.engine?.state.phase === 'paused') {
      this.engine.pause(false);
    }
  }

  private closeOverlayModal(): void {
    if (this.screen === 'battle' && this.engine?.state.phase === 'paused') {
      // Closing Settings from Pause goes back to Pause; closing Recipes resumes directly!
      if (this.modal === 'settings') {
        this.modal = 'pause';
      } else {
        this.resumeBattle();
      }
      return;
    }
    this.modal = null;
  }

  private returnToMenu(): void {
    this.screen = 'menu';
    this.modal = null;
    this.engine = null;
    this.selectedId = undefined;
    this.shovelSelected = false;
    this.activePropId = undefined;
    this.expandedPassiveId = undefined;
    this.tutorialStep = 'done';
    this.drag = undefined;
  }

  private unitAt(hit: HitTarget): Unit | undefined {
    if (!this.engine || hit.kind === 'shovel' || hit.kind === 'bench-lock') return undefined;
    return this.engine.state.units.find(u =>
      u.side === 'player' && (hit.kind === 'bench'
        ? u.location.zone === 'bench' && u.location.slot === hit.slot
        : u.location.zone === 'board' && u.location.col === hit.col && u.location.row === hit.row),
    );
  }

  private handleBoardTapOrDrop(hit: HitTarget, moved: boolean): void {
    if (!this.engine) return;
    if (hit.kind === 'bench-lock') {
      const res = this.engine.toggleBenchLock(hit.slot);
      if (res.ok) this.platform.audio.play('click');
      return;
    }
    if (hit.kind === 'shovel') {
      if (this.selectedId && this.engine.state.units.some(u => u.id === this.selectedId && u.kind === 'shovel' && u.location.zone === 'bench')) {
        if (this.engine.storeShovel(this.selectedId).ok) this.platform.audio.play('shovel');
        this.selectedId = undefined;
      } else if (!moved) {
        this.shovelSelected = !this.shovelSelected;
        this.selectedId = undefined;
        this.platform.audio.play('click');
      }
      return;
    }
    if (this.shovelSelected && hit.kind === 'cell') {
      const res = this.engine.dig(hit.col, hit.row);
      if (res.ok) {
        this.platform.audio.play('shovel');
        this.advanceBattleTutorial('dig');
        if (this.engine.state.sides.player.shovels <= 0) this.shovelSelected = false;
      } else {
        this.showToast(t(res.key), 'warn', 1.6);
      }
      return;
    }
    const target = this.unitAt(hit);
    if (this.selectedId && target?.id !== this.selectedId) {
      const loc: UnitLocation = hit.kind === 'bench' ? { zone: 'bench', slot: hit.slot } : { zone: 'board', col: hit.col, row: hit.row };
      const res = this.engine.move(this.selectedId, loc);
      if (res.ok) {
        if (res.key === 'hint.dig' || res.key === 'hint.repaired') {
          this.platform.audio.play('shovel');
          this.advanceBattleTutorial('dig');
        } else if (res.key === 'hint.merged' || res.key === 'hint.fed' || res.key === 'p17.breakthroughSuccess') {
          this.platform.audio.play('merge_hero');
          this.advanceBattleTutorial('merge');
        } else {
          this.platform.audio.play('click');
          if (loc.zone === 'board') this.advanceBattleTutorial('deploy');
        }
        this.selectedId = res.key === 'hint.deployed' ? undefined : res.unitId;
      } else {
        this.showToast(t(res.key), 'warn', 1.6);
      }
    } else if (target) {
      this.selectedId = target.id;
      this.shovelSelected = false;
      this.platform.audio.play('click');
    } else {
      this.selectedId = undefined;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.platform.cancelFrame(this.rafId);
    this.platform.dispose();
  }
}

export { ECONOMY };
