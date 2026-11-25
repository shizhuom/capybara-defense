import { BattleEngine } from '../core/BattleEngine';
import { HEROES } from '../config/heroes';
import { BROTH_IDS, type BrothId } from '../config/kitchen';
import { PROPS } from '../config/props';
import { getRank } from '../config/ranks';
import { getMap, setMobileWideStage, STAGE } from '../config/maps';
import { ECONOMY } from '../config/units';
import { isFacilityId } from '../config/village';
import { WEAPONS } from '../config/weapons';
import {
  buildDebugStageProfile,
  claimFeatureStarterGift,
  hasOnboarded,
  isFeatureUnlocked,
  markOnboarded,
  maxBattleSpeed,
  pendingMenuOnboarding,
  type FeatureId,
} from '../core/FeatureUnlocks';
import {
  brewBroth,
  buyIngredientBasket,
  equipBroth,
  upgradeBroth,
} from '../core/KitchenProgression';
import { upgradeMedallion } from '../core/MedallionProgression';
import {
  buyProp,
  createLotteryPrizes,
  ensureDailyShop,
  equipProp,
  equipWeapon,
  recycleFragments,
  refreshShop,
  spinLottery,
  type LotteryPrize,
} from '../core/MetaProgression';
import { validateNickname } from '../core/PlayerIdentity';
import {
  getMapUnlockRequirement,
  pickBattleMap,
  resolveMap,
  selectAvatar,
  selectMap,
  updateSettings,
} from '../core/PlayerProgression';
import { propTargetKind, resolvePropDrop } from '../core/PropTargets';
import {
  STAMINA_COST_PER_BATTLE,
  STAMINA_MAX,
  STAMINA_REFILL_AMOUNT,
  buyStaminaWithCoins,
  grantStamina,
  settleStamina,
  spendStamina,
} from '../core/Stamina';
import { advanceTutorial, finishTutorial, replayTutorial, type TutorialStep } from '../core/Tutorial';
import {
  buildFacility,
  claimOfflineHarvest,
  getVillageResidents,
  localDay,
  petVillageResident,
  settleVillageClock,
  villageLoadout,
} from '../core/VillageProgression';
import type { BattleState, MapId, Profile, Unit, UnitLocation } from '../core/types';
import { getLanguage, setLanguage, t } from '../i18n/i18n';
import { PET_QUOTE_COUNT } from '../i18n/p16';
import { StickerRenderer, type HitTarget } from '../render/StickerRenderer';
import { getMusicMode } from '../ui/BattleHUD';
import { EndlessLeaderboardClient } from '../ui/EndlessLeaderboardClient';
import {
  computeDialogGuideStep,
  nextBattleLesson,
  type BattleLessonKey,
  type DialogGuideStep,
} from '../ui/OnboardingGuide';
import { nextBattleSpeed } from '../ui/P13HUD';
import {
  awardBattle,
  awardEndless,
  emptyProfile,
  enableTestProfile,
  isTestProfile,
  loadProfile,
  resetOwnStorage,
  restoreNormalProfile,
  saveProfile,
} from '../ui/storage';
import type { PlatformAdapter, TouchEventData, ViewportMetrics } from '../platform/types';
import {
  MINIGAME_LEADERBOARD_URL,
  buildSharePayload,
  getAdUnitId,
  isAdPlacementAvailable,
  type AdPlacement,
} from './adConfig';
import { MinigameAssetManager } from './MinigameAssetManager';
import { BattleAudioBridge } from './BattleAudioBridge';
import {
  ScrollRegion,
  UiHitManager,
  drawFullBleedBackdrop,
  drawToast,
  type ToastMessage,
  type UiHitBox,
} from './ui/CanvasUI';
import { drawMenuScreen } from './ui/MenuScreen';
import { drawBattleOverlay } from './ui/BattleOverlay';
import {
  drawActiveModal,
  type CompendiumTab,
  type MinigameModalKind,
  type ModalLayoutInfo,
  type SettlementMeta,
} from './ui/BattleModals';
import {
  compendiumCatalog,
  compendiumOwnerTab,
  type CompendiumUiState,
} from './ui/MetaCompendium';
import {
  getSortedArmoryWeapons,
  type ArmoryState,
  type ArmoryTab,
  type MarketState,
} from './ui/MetaArmoryMarket';
import type { KitchenUiState, VillageUiState } from './ui/MetaVillageKitchen';
import type { LeaderboardUiState, MedallionHubTab, ProfileHubTab } from './ui/MetaMedallionsRanks';

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
 * Complete playable mini-game host on `PlatformAdapter` (`wx` / `bl` / `web` preview).
 * Runs Courtyard Menu, Full Battle Loop, Match-1 Tutorial, Pause/Endless/Settlement,
 * all 7 Meta Hubs (Armory, Market/Gacha/Backpack, Onsen Village, Kitchen, Medallions,
 * Global & 54-Rank Leaderboard, Keeper Passport), P19 Progressive Onboarding,
 * Rewarded Video Ad hooks, and WeChat/Bilibili Share — 100% pure Canvas 2D.
 */
export class MinigameApp {
  private readonly renderer: StickerRenderer;
  private readonly assetManager: MinigameAssetManager;
  private readonly audioBridge = new BattleAudioBridge();
  private readonly leaderboardClient: EndlessLeaderboardClient;
  private readonly hits = new UiHitManager();
  private readonly scroll = new ScrollRegion();

  private profile: Profile;
  private engine: BattleEngine | null = null;
  private screen: 'menu' | 'battle' = 'menu';
  private modal: MinigameModalKind = null;
  private modalReturnTo: MinigameModalKind = null;
  private modalLayout: ModalLayoutInfo = {};
  private compendium: CompendiumUiState = { tab: 'matrix', detailId: null, previewAwakened: false };

  // Strict 1:1 Web Meta Hub UI States
  private armory: ArmoryState = { family: 'all', detailWeaponId: null, recycleRarities: [0, 1, 2, 3, 4] };
  private market: MarketState;
  private villageUi: VillageUiState;
  private kitchenUi: KitchenUiState = { tab: 'broths', detailBrothId: null, lastBasketGained: [] };
  private leaderboardUi: LeaderboardUiState;
  private onboardingFeature: FeatureId | null = null;
  private activeGuideFeature: FeatureId | null = null;
  private battleLesson: BattleLessonKey | null = null;
  private devUnlocked = false;
  private devTapCount = 0;
  private devTapLastAt = 0;

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
  private reviveUsedThisBattle = false;
  private curtainRemaining = 0;
  private drag?: DragState;
  private toast: ToastMessage | null = null;
  private settlement: SettlementMeta = {
    savedResult: true,
    resultStars: 0,
    previousRank: 0,
    newWeapons: [],
    newAvatars: [],
    ticketAwarded: false,
    statsOpen: false,
    adDoubleCoinsAvailable: false,
    adDoubleClaimed: false,
    adReviveAvailable: false,
  };
  private disposed = false;

  constructor(private readonly platform: PlatformAdapter) {
    setMobileWideStage(true);
    this.profile = settleStamina(settleVillageClock(loadProfile(platform.storage), Date.now()), Date.now());
    this.profile = ensureDailyShop(this.profile, localDay(), Math.random);
    this.platform.audio.setSettings(this.profile.settings);
    this.muted = this.profile.settings.musicVolume <= 0 && this.profile.settings.soundVolume <= 0;

    this.leaderboardClient = new EndlessLeaderboardClient({
      baseUrl: MINIGAME_LEADERBOARD_URL,
      fetch: platform.fetch,
      storage: platform.storage,
    });

    this.market = {
      tab: 'shop',
      merchantQuip: 0,
      prizes: createLotteryPrizes(this.profile, Math.random),
      lastPrizeIndex: null,
      lastPrizeLabel: '',
      spunThisVisit: false,
      adRefreshAvailable: isAdPlacementAvailable(platform.kind, 'free_shop_refresh'),
      adGachaAvailable: isAdPlacementAvailable(platform.kind, 'free_gacha'),
    };
    this.villageUi = {
      tab: 'courtyard',
      focusFacilityId: null,
      elapsed: 0,
      nowMs: Date.now(),
      petFeedback: null,
      interacted: false,
      adDoubleHarvestAvailable: isAdPlacementAvailable(platform.kind, 'double_harvest'),
    };
    this.leaderboardUi = {
      endlessSnap: this.leaderboardClient.snapshot(),
      rankSnap: this.leaderboardClient.rankSnapshot(),
      loading: false,
      showRankLadder: false,
      medallionTab: 'medallions',
    };

    this.renderer = new StickerRenderer(platform.canvas, { managedViewport: true });
    this.syncViewport(platform.viewport());
    this.assetManager = new MinigameAssetManager(platform);
    void this.assetManager.bootMainAssets().then(() => {
      // Returning players may show meta avatars/broths on courtyard menu; warm meta subpackage silently.
      if (this.profile.avatarId !== 'capybara' || this.profile.activeBrothId || isFeatureUnlocked(this.profile, 'armory')) {
        void this.assetManager.ensureSubpackage('meta');
      }
    });

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

    this.checkMenuOnboarding();
    this.lastTs = platform.now();
    this.rafId = platform.requestFrame(ts => this.loop(ts));
  }

  /** Exposed read-only snapshot for automated QA and unit tests. */
  getDebugState() {
    return {
      screen: this.screen,
      modal: this.modal,
      selectedId: this.selectedId,
      tutorialStep: this.tutorialStep,
      speed: this.speed,
      profile: this.profile,
      battleState: this.engine?.state ?? null,
      compendium: this.compendium,
      armory: this.armory,
      marketTab: this.market.tab,
      villageTab: this.villageUi.tab,
      kitchenTab: this.kitchenUi.tab,
      medallionTab: this.leaderboardUi.medallionTab,
      leaderboardTab: this.modal === 'endless-board' ? 'endless' : 'rank',
      activeGuideFeature: this.activeGuideFeature,
      battleLesson: this.battleLesson,
    };
  }

  /** Helper for automated tests / external triggers to open any hub directly. */
  openHub(hub: Exclude<MinigameModalKind, null>): void {
    this.openModal(hub);
  }

  /** Helper for automated tests to inspect live UI button bounds by hit id. */
  findHitBox(id: string): UiHitBox | undefined {
    return this.hits.findById(id);
  }

  /** Developer QA API exposed on `globalThis.__capyDev` for WeChat DevTools Console & QA testing. */
  getDevApi() {
    return {
      openDev: () => {
        this.devUnlocked = true;
        this.openModal('dev');
      },
      stage: (stage: number) => this.jumpToOnboardingStage(stage),
      unlockAll: () => this.applyDevUnlockAll(),
      restore: () => this.applyDevRestore(),
      reset: () => this.applyDevReset(),
    };
  }

  private jumpToOnboardingStage(stage: number): void {
    const s = Math.max(0, Math.min(8, Math.trunc(stage)));
    this.profile = buildDebugStageProfile(this.profile, s);
    this.profile = ensureDailyShop(this.profile, localDay(), Math.random);
    this.save();
    this.returnToMenu();
    this.showToast(t('p19.devStageDone', { stage: s }), 'good', 2.6);
  }

  private applyDevUnlockAll(): void {
    this.profile = enableTestProfile(this.platform.storage);
    this.profile = ensureDailyShop({ ...this.profile, stamina: STAMINA_MAX, staminaUpdatedAt: Date.now() }, localDay(), Math.random);
    this.save();
    this.returnToMenu();
    this.showToast(getLanguage() === 'zh-CN' ? '🌟 已开启全解锁测试档！' : '🌟 Full unlock test save enabled!', 'good', 2.4);
  }

  private applyDevRestore(): void {
    this.profile = restoreNormalProfile(this.platform.storage);
    this.profile = ensureDailyShop(this.profile, localDay(), Math.random);
    this.returnToMenu();
    this.showToast(getLanguage() === 'zh-CN' ? '↩ 已恢复正式存档！' : '↩ Restored normal save!', 'good', 2.4);
  }

  private applyDevReset(): void {
    resetOwnStorage(this.platform.storage);
    this.profile = ensureDailyShop(emptyProfile(), localDay(), Math.random);
    this.save();
    this.returnToMenu();
    this.showToast(t('hint.reset'), 'warn', 2.2);
  }

  private syncViewport(vp: ViewportMetrics): void {
    this.renderer.setViewportTransform(vp.stageScale, vp.stageOffsetX, vp.stageOffsetY);
  }

  private save(): void {
    saveProfile(this.profile, this.platform.storage);
  }

  private topRightEdge(vp: ViewportMetrics): number {
    const scale = Math.max(0.25, vp.stageCssWidth / STAGE.width);
    const baseRight = vp.visible.right > 1290
      ? Math.min(vp.safeStage.right - 14, Math.min(1356, vp.visible.right - 26))
      : Math.min(1262, vp.safeStage.right - 14);
    if (this.platform.kind === 'web') return Math.round(Math.max(1060, baseRight));
    // WeChat mini-games display BOTH the [···|◉] capsule AND an optional [🎮] game button ~50 CSS px to its left.
    // Reserve ~54 CSS px left of menuButton (or ~164 CSS px from visible right) so top-right controls NEVER collide!
    const minRight = Math.round(Math.max(976, vp.visible.right - 310));
    if (vp.capsuleStageLeft !== undefined) {
      const clearGameBtn = vp.capsuleStageLeft - Math.round(54 / scale);
      return Math.round(Math.max(minRight, Math.min(baseRight, clearGameBtn)));
    }
    const fallbackCapsuleLeft = vp.visible.right - 164 / scale;
    return Math.round(Math.max(minRight, Math.min(baseRight, fallbackCapsuleLeft)));
  }

  private showToast(text: string, tone: 'info' | 'good' | 'warn' = 'info', duration = 2.4): void {
    this.toast = { text, tone, remaining: duration, duration };
  }

  /** Checks for newly unlocked P19 courtyard milestones (Armory / Market / Village / Kitchen / Medallions). */
  private checkMenuOnboarding(): void {
    if (this.screen !== 'menu' || this.modal) return;
    const pending = pendingMenuOnboarding(this.profile);
    if (pending) {
      this.onboardingFeature = pending;
      this.modal = 'onboard';
      return;
    }
  }

  private computeCurrentDialogGuideStep(): DialogGuideStep | null {
    if (!this.activeGuideFeature || !this.modal) return null;
    return computeDialogGuideStep(this.activeGuideFeature, this.profile, {
      dialogKind: this.modal,
      detailWeaponId: this.armory.detailWeaponId,
      marketTab: this.market.tab,
      marketSpun: this.market.spunThisVisit,
      villageTab: this.villageUi.tab,
      villageInteracted: this.villageUi.interacted,
    });
  }

  private openModal(kind: Exclude<MinigameModalKind, null>, returnTo: MinigameModalKind = null): void {
    this.modal = kind;
    this.modalReturnTo = returnTo;
    this.scroll.reset();

    if (kind === 'recipes') {
      this.compendium.detailId = null;
      this.compendium.previewAwakened = false;
      void this.assetManager.ensureSubpackage('meta');
    } else if (kind === 'armory') {
      this.armory.detailWeaponId = null;
      void this.assetManager.ensureSubpackage('meta');
    } else if (kind === 'market') {
      this.profile = ensureDailyShop(this.profile, localDay(), Math.random);
      this.market.spunThisVisit = false;
      void this.assetManager.ensureSubpackage('meta');
    } else if (kind === 'village') {
      this.villageUi.nowMs = Date.now();
      this.villageUi.focusFacilityId = null;
      this.villageUi.interacted = false;
      this.profile = settleVillageClock(this.profile, this.villageUi.nowMs);
      void this.assetManager.ensureSubpackage('maps');
    } else if (kind === 'kitchen') {
      this.kitchenUi.detailBrothId = null;
      void this.assetManager.ensureSubpackage('meta');
    } else if (kind === 'medallions') {
      void this.assetManager.ensureSubpackage('meta');
      if (this.leaderboardUi.medallionTab === 'endless-board') {
        void this.refreshLeaderboards(false);
      }
    } else if (kind === 'leaderboard' || kind === 'endless-board') {
      this.leaderboardUi.showRankLadder = false;
      void this.assetManager.ensureSubpackage('meta');
      void this.refreshLeaderboards(false);
    } else if (kind === 'profile' || kind === 'settings') {
      this.leaderboardUi.showRankLadder = false;
      void this.assetManager.ensureSubpackage('meta');
    }
  }

  private async refreshLeaderboards(force: boolean): Promise<void> {
    this.leaderboardUi.loading = true;
    try {
      const lang = getLanguage();
      void this.leaderboardClient.submitRank(this.profile, lang);
      if ((this.profile.bestEndlessWave ?? 0) >= 11) {
        void this.leaderboardClient.submitScore(this.profile, lang);
      }
      const [rankSnap, endlessSnap] = await Promise.all([
        this.leaderboardClient.refreshRank(this.profile.playerId, force),
        this.leaderboardClient.refresh(this.profile.playerId, force),
      ]);
      this.leaderboardUi.rankSnap = rankSnap;
      this.leaderboardUi.endlessSnap = endlessSnap;
    } finally {
      this.leaderboardUi.loading = false;
    }
  }

  private async promptNicknameEdit(): Promise<void> {
    const zh = getLanguage() === 'zh-CN';
    const raw = await this.platform.showKeyboard({
      value: this.profile.nickname,
      maxLength: 14,
      placeholder: zh ? '输入 2~14 字昵称' : 'Enter 2–14 char nickname',
      confirmText: zh ? '保存' : 'Save',
    });
    if (raw === null) return;
    const check = validateNickname(raw);
    if (!check.ok) {
      this.showToast(t(check.key), 'warn', 2.4);
      return;
    }
    this.profile = { ...this.profile, nickname: check.value };
    this.save();
    this.showToast(t('p17.nameSaved'), 'good', 2.0);
    void this.refreshLeaderboards(true);
  }

  private async runRewardedAd(placement: AdPlacement, onReward: () => void): Promise<void> {
    const unitId = getAdUnitId(this.platform.kind, placement);
    const outcome = await this.platform.showRewardedAd(unitId);
    if (outcome === 'completed') {
      onReward();
    } else if (outcome === 'skipped') {
      this.showToast(
        getLanguage() === 'zh-CN' ? '需看完完整视频才能领取奖励哦' : 'Watch the full video to claim the reward!',
        'warn',
        2.2,
      );
    } else {
      this.showToast(
        getLanguage() === 'zh-CN' ? '广告暂时不可用，请稍后再试' : 'Ad unavailable right now — try again later.',
        'warn',
        2.2,
      );
    }
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
    if (this.curtainRemaining > 0) {
      this.curtainRemaining = Math.max(0, this.curtainRemaining - rawDt);
    }
    this.scroll.tick(rawDt);

    if (this.screen === 'battle' && this.engine && this.engine.state.phase === 'playing' && !this.modal) {
      this.engine.tick(rawDt * this.speed);
      this.audioBridge.observe(this.engine.state, this.platform.audio, ts);
      if (this.engine.state.result) {
        this.handleBattleFinished(this.engine.state);
      }
    }

    const browsing = this.screen !== 'battle' || this.modal !== null;
    this.platform.audio.setMusicMode?.(getMusicMode(this.engine?.state, browsing));

    if (this.screen === 'menu' || this.modal === 'stamina') {
      const settled = settleStamina(this.profile, Date.now());
      if (settled !== this.profile) {
        this.profile = settled;
        this.save();
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
        const prevAvatars = this.profile.unlockedAvatars;
        const res = awardEndless(this.profile, state.id, result);
        if (res.awarded) {
          this.profile = res.profile;
          const newlyUnlockedAvatars = res.profile.unlockedAvatars.filter(a => !prevAvatars.includes(a));
          this.settlement.savedResult = saveProfile(this.profile, this.platform.storage);
          this.settlement.newWeapons = [...this.settlement.newWeapons, ...res.newWeapons];
          this.settlement.newAvatars = [...this.settlement.newAvatars, ...newlyUnlockedAvatars];
          this.settlement.adDoubleCoinsAvailable = isAdPlacementAvailable(this.platform.kind, 'double_settlement');
          this.settlement.adDoubleClaimed = false;
          this.settlement.adReviveAvailable = false;
          this.platform.audio.play('victory');
          void this.leaderboardClient.submitScore(this.profile, getLanguage());
        }
      }
      this.modal = 'result';
      return;
    }

    if (!this.profile.awardedBattles.includes(state.id)) {
      const prevStars = this.profile.stars;
      const prevRank = getRank(prevStars).index;
      const prevAvatars = this.profile.unlockedAvatars;
      const res = awardBattle(this.profile, state.id, result);
      if (res.awarded) {
        this.profile = res.profile;
        const newlyUnlockedAvatars = res.profile.unlockedAvatars.filter(a => !prevAvatars.includes(a));
        const saved = saveProfile(this.profile, this.platform.storage);
        this.settlement = {
          savedResult: saved,
          resultStars: this.profile.stars - prevStars,
          previousRank: prevRank,
          newWeapons: res.newWeapons,
          newAvatars: newlyUnlockedAvatars,
          ticketAwarded: Boolean(res.ticketAwarded),
          statsOpen: false,
          adDoubleCoinsAvailable: result.winner === 'player' && isAdPlacementAvailable(this.platform.kind, 'double_settlement'),
          adDoubleClaimed: false,
          adReviveAvailable: result.winner !== 'player' && result.reason === 'oranges' && !this.reviveUsedThisBattle && isAdPlacementAvailable(this.platform.kind, 'revive'),
        };
        this.platform.audio.play(result.winner === 'player' ? 'victory' : 'defeat');
        void this.leaderboardClient.submitRank(this.profile, getLanguage());
      }
    }

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
    this.syncViewport(vp);
    const c = this.platform.ctx;
    const topRight = this.topRightEdge(vp);

    this.hits.clear();
    c.save();
    c.setTransform(vp.stageScale, 0, 0, vp.stageScale, vp.stageOffsetX, vp.stageOffsetY);

    if (this.screen === 'menu' || !this.engine) {
      const mapId = resolveMap(this.profile);
      drawFullBleedBackdrop(c, 'start_splash_bg', vp, 72, 64, '#d8deb6');
      this.renderer.drawPreview(mapId, this.elapsedSec, 3);
      // Keep courtyard HUD visible on home & lightweight P19 welcome card; hide behind full modals to avoid × / footer clash!
      if (!this.modal || this.modal === 'onboard') {
        drawMenuScreen(c, this.hits, {
          profile: this.profile,
          elapsed: this.elapsedSec,
          muted: this.muted,
          topRightEdge: topRight,
          viewport: vp,
          highlightFeature: this.modal === 'onboard' ? this.onboardingFeature : null,
        });
      }
    } else {
      const state = this.engine.state;
      const mapTheme = getMap(state.mapId).theme;
      drawFullBleedBackdrop(c, `map_${state.mapId}`, vp, 102, 62, mapTheme.grass[0], 24);
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
      if (this.modal !== 'result') {
        drawBattleOverlay(c, this.hits, {
          engine: this.engine,
          profile: this.profile,
          elapsed: this.elapsedSec,
          speed: this.speed,
          shovelSelected: this.shovelSelected,
          activePropId: this.activePropId,
          expandedPassiveId: this.expandedPassiveId,
          highlightPropId: this.modal === 'battle-lesson' && this.battleLesson === 'prop_battle' ? 'glue_trap' : undefined,
          tutorialStep: this.tutorialStep,
          topRightEdge: topRight,
          viewport: vp,
          curtainRemaining: this.curtainRemaining,
        });
      }
    }

    if (this.modal) {
      this.hits.clear();
      this.villageUi.elapsed = this.elapsedSec;
      this.villageUi.nowMs = Date.now();
      this.modalLayout = drawActiveModal(c, this.hits, {
        modal: this.modal,
        profile: this.profile,
        state: this.engine?.state ?? null,
        settlement: this.settlement,
        compendium: this.compendium,
        scroll: this.scroll,
        armory: this.armory,
        market: this.market,
        village: this.villageUi,
        kitchen: this.kitchenUi,
        leaderboard: this.leaderboardUi,
        onboardingFeature: this.onboardingFeature,
        battleLesson: this.battleLesson,
        dialogGuideStep: this.computeCurrentDialogGuideStep(),
        devUnlocked: this.devUnlocked,
        isTestSave: isTestProfile(this.platform.storage),
        adStaminaAvailable: isAdPlacementAvailable(this.platform.kind, 'stamina_refill'),
        elapsed: this.elapsedSec,
        viewport: vp,
      });
    } else {
      this.modalLayout = {};
    }

    drawToast(c, this.toast, STAGE.width, this.modal ? 674 : this.screen === 'battle' ? 68 : 82);
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

  private async startBattle(opts?: { freeStamina?: boolean }): Promise<void> {
    if (!opts?.freeStamina) {
      const spent = spendStamina(this.profile, STAMINA_COST_PER_BATTLE, Date.now());
      if (!spent.ok) {
        const zh = getLanguage() === 'zh-CN';
        this.profile = spent.profile;
        this.save();
        this.openModal('stamina');
        this.showToast(
          zh ? `⚡ 体力不足！每局需要 ${STAMINA_COST_PER_BATTLE} 点体力` : `⚡ Need ${STAMINA_COST_PER_BATTLE} Energy to start!`,
          'warn',
          2.2,
        );
        return;
      }
      this.profile = spent.profile;
      this.save();
    }
    const map = pickBattleMap(this.profile);
    await this.assetManager.ensureMap(map.id);
    if (
      map.id !== 'sunny_backyard' ||
      this.profile.equippedActiveProps.length > 0 ||
      this.profile.equippedPassiveProps.length > 0 ||
      Boolean(this.profile.activeBrothId) ||
      isFeatureUnlocked(this.profile, 'endless')
    ) {
      void this.assetManager.ensureSubpackage('meta');
    }
    this.assetManager.releaseHeavyIdleSprites(map.id);

    const guided = !this.profile.tutorialCompleted;
    const bestStars = Math.max(this.profile.stars, this.profile.highestStars);
    this.engine = new BattleEngine({
      mapId: map.id,
      rankIndex: getRank(this.profile.stars).index,
      loadouts: { player: villageLoadout(this.profile) },
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
    this.modalReturnTo = null;
    this.reviveUsedThisBattle = false;
    this.curtainRemaining = guided ? 0 : 0.85;
    this.selectedId = undefined;
    this.shovelSelected = false;
    this.activePropId = undefined;
    this.expandedPassiveId = undefined;
    this.drag = undefined;
    this.platform.audio.play('wave_start');

    // One-time in-battle lessons (speed2x, prop_battle, speed3x — exact Web `nextBattleLesson`!)
    if (!guided) {
      const lesson = nextBattleLesson(this.profile, {
        endless: false,
        hasActiveProp: this.profile.equippedActiveProps.length > 0,
      });
      if (lesson) {
        this.battleLesson = lesson;
        this.engine.pause(true);
        this.modal = 'battle-lesson';
      }
    }
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
      this.save();
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

    if (hit) {
      this.hits.activeId = hit.id;
      return;
    }

    if (this.screen !== 'battle' || !this.engine || this.engine.state.phase !== 'playing') return;
    this.expandedPassiveId = undefined;

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
      this.save();
      return;
    }

    if (this.scrollingModal) {
      const wasScroll = this.scroll.onEnd();
      this.scrollingModal = false;
      if (wasScroll) { this.hits.activeId = null; return; }
    }

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

    const pressedId = this.hits.activeId;
    this.hits.activeId = null;
    if (pressedId) {
      const releaseHit = this.hits.hit(p.stageX, p.stageY);
      if (releaseHit && releaseHit.id === pressedId) {
        this.handleUiAction(releaseHit);
      }
      return;
    }

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

  private formatPrizeLabel(prize: LotteryPrize): string {
    const zh = getLanguage() === 'zh-CN';
    if (prize.type === 'coins') return `🪙 +${prize.amount}`;
    if (prize.type === 'prop' && prize.id && PROPS[prize.id]) {
      return `${PROPS[prize.id].icon} ${zh ? PROPS[prize.id].name['zh-CN'] : PROPS[prize.id].name.en}`;
    }
    if (prize.type === 'fragment' && prize.id && WEAPONS[prize.id]) {
      return `🧩 ${zh ? WEAPONS[prize.id].name['zh-CN'] : WEAPONS[prize.id].name.en}`;
    }
    return '🎁';
  }

  private handleUiAction(box: UiHitBox): void {
    const id = box.id;
    const lang = getLanguage();
    const zh = lang === 'zh-CN';

    if (id === 'modal:backdrop') {
      if (this.modal === 'pause') this.resumeBattle();
      else if (this.modal && !['endless-offer', 'result', 'onboard', 'battle-lesson'].includes(this.modal)) {
        this.closeOverlayModal();
      }
      return;
    }
    if (id === 'modal:card' || id === 'battle:card-bg' || id === 'battle:tutorial-bg') return;

    this.platform.audio.play('click');

    // ── Menu Actions ────────────────────────────────────────────────────────
    if (id === 'menu:start') { void this.startBattle(); return; }
    if (id === 'menu:stamina') { this.openModal('stamina'); return; }
    if (id === 'stamina:buy') {
      const res = buyStaminaWithCoins(this.profile, Date.now());
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.platform.audio.play('coin');
        this.showToast(zh ? `⚡ 体力 +${STAMINA_REFILL_AMOUNT}！精力充沛！` : `⚡ +${STAMINA_REFILL_AMOUNT} Energy!`, 'good', 2.0);
      } else {
        this.showToast(zh ? '金币不足，无法购买茶歇体力' : 'Not enough coins for Energy refill', 'warn', 1.8);
      }
      return;
    }
    if (id === 'stamina:ad') {
      void this.runRewardedAd('stamina_refill', () => {
        this.profile = grantStamina(this.profile, STAMINA_REFILL_AMOUNT, Date.now());
        this.save();
        this.platform.audio.play('gacha_win');
        this.showToast(zh ? `🎬 领取成功！体力 +${STAMINA_REFILL_AMOUNT}` : `🎬 +${STAMINA_REFILL_AMOUNT} Energy!`, 'good', 2.2);
      });
      return;
    }
    if (id === 'menu:lang' || id === 'settings:lang') { setLanguage(zh ? 'en' : 'zh-CN'); return; }
    if (id === 'menu:mute') {
      this.muted = !this.muted;
      this.profile = updateSettings(this.profile, this.muted
        ? { musicVolume: 0, soundVolume: 0 }
        : { musicVolume: 0.5, soundVolume: 0.75 });
      this.platform.audio.setSettings(this.profile.settings);
      this.save();
      return;
    }
    if (id === 'menu:share' || id === 'profile:share' || id === 'lb:share') {
      this.platform.share(buildSharePayload(this.profile, id === 'menu:share' ? 'menu' : 'profile'));
      this.showToast(zh ? '📤 已唤起分享卡片！' : '📤 Share card opened!', 'good', 1.8);
      return;
    }
    if (id === 'menu:settings') { this.openModal('settings'); return; }
    if (id === 'modal:open-settings') { this.openModal('settings', 'pause'); return; }
    if (id === 'modal:open-profile') { this.openModal('profile', 'pause'); return; }
    if (id === 'menu:recipes') { this.openModal('recipes'); return; }
    if (id === 'menu:profile') { this.openModal('profile'); return; }

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
        this.save();
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
      const hub = id.slice('menu:hub:'.length) as Exclude<MinigameModalKind, null>;
      this.openModal(hub);
      return;
    }

    // ── P19 Onboarding Celebration, In-Dialog Guide & Battle Lessons ─────────
    if (id.startsWith('onboard:go:')) {
      const feat = id.slice('onboard:go:'.length) as FeatureId;
      const gift = claimFeatureStarterGift(this.profile, feat, Date.now());
      this.profile = gift.profile;
      this.save();
      this.onboardingFeature = null;
      if (feat === 'armory' || feat === 'market' || feat === 'village' || feat === 'kitchen' || feat === 'medallions') {
        this.activeGuideFeature = feat;
        if (feat === 'armory') this.armory.family = 'all';
        if (feat === 'market') this.market.tab = 'shop';
        if (feat === 'village') this.villageUi.tab = 'courtyard';
        if (feat === 'kitchen') this.kitchenUi.tab = 'broths';
        if (feat === 'medallions') this.leaderboardUi.medallionTab = 'medallions';
        this.openModal(feat);
      } else {
        this.profile = markOnboarded(this.profile, feat);
        this.save();
        this.modal = null;
      }
      return;
    }
    if (id.startsWith('onboard:dismiss:') || id.startsWith('onboard:done:') || id.startsWith('onboard:skip:')) {
      const feat = id.slice(id.lastIndexOf(':') + 1) as FeatureId;
      const gift = claimFeatureStarterGift(this.profile, feat, Date.now());
      this.profile = markOnboarded(gift.profile, feat);
      this.save();
      this.onboardingFeature = null;
      if (this.activeGuideFeature === feat) this.activeGuideFeature = null;
      if (this.modal === 'onboard') {
        this.modal = null;
        this.checkMenuOnboarding();
      }
      return;
    }
    if (id.startsWith('lesson:ok:')) {
      const lesson = id.slice('lesson:ok:'.length) as BattleLessonKey;
      this.profile = markOnboarded(this.profile, lesson);
      this.save();
      this.battleLesson = null;
      this.resumeBattle();
      return;
    }

    // ── Modal Switch Links (In-Battle Armory ⇄ Market, Endless Board → Medallions) ──
    if (id.startsWith('modal:switch:')) {
      const target = id.slice('modal:switch:'.length) as Exclude<MinigameModalKind, null>;
      this.openModal(target, this.modalReturnTo);
      return;
    }

    // ── 6-Tab Compendium & Detail Sub-Page ──────────────────────────────────
    if (id.startsWith('compendium:tab:')) {
      this.compendium.tab = id.slice('compendium:tab:'.length) as CompendiumTab;
      this.compendium.detailId = null;
      this.compendium.previewAwakened = false;
      this.scroll.reset();
      return;
    }
    if (id.startsWith('compendium:entry:')) {
      const entryId = id.slice('compendium:entry:'.length);
      const owner = compendiumOwnerTab(entryId);
      if (this.compendium.tab !== 'matrix' && owner && owner !== this.compendium.tab) {
        this.compendium.tab = owner;
      }
      this.compendium.detailId = entryId;
      this.compendium.previewAwakened = false;
      this.scroll.reset();
      return;
    }
    if (id === 'compendium:back') {
      this.compendium.detailId = null;
      this.compendium.previewAwakened = false;
      this.scroll.reset();
      return;
    }
    if (id === 'compendium:prev' || id === 'compendium:next') {
      const list = compendiumCatalog(this.compendium.tab);
      if (list.length > 0 && this.compendium.detailId) {
        const cur = list.indexOf(this.compendium.detailId);
        const step = id === 'compendium:next' ? 1 : -1;
        const nextIdx = cur >= 0 ? (cur + step + list.length) % list.length : 0;
        this.compendium.detailId = list[nextIdx];
        this.compendium.previewAwakened = false;
        this.scroll.reset();
      }
      return;
    }
    if (id === 'compendium:awakened') {
      this.compendium.previewAwakened = !this.compendium.previewAwakened;
      return;
    }

    // ── Hub #1: Weapon Armory (5 Tabs + Detail Sheet + Recycle Workshop) ────
    if (id.startsWith('armory:family:')) {
      this.armory.family = id.slice('armory:family:'.length) as ArmoryTab;
      this.armory.detailWeaponId = null;
      this.scroll.reset();
      return;
    }
    if (id.startsWith('armory:open:')) {
      this.armory.detailWeaponId = id.slice('armory:open:'.length);
      this.scroll.reset();
      return;
    }
    if (id === 'armory:back') {
      this.armory.detailWeaponId = null;
      this.scroll.reset();
      return;
    }
    if (id === 'armory:prev' || id === 'armory:next') {
      const list = getSortedArmoryWeapons(this.profile, this.armory.family);
      if (list.length > 0 && this.armory.detailWeaponId) {
        const cur = list.findIndex(w => w.id === this.armory.detailWeaponId);
        const step = id === 'armory:next' ? 1 : -1;
        const nextIdx = cur >= 0 ? (cur + step + list.length) % list.length : 0;
        this.armory.detailWeaponId = list[nextIdx].id;
        this.scroll.reset();
      }
      return;
    }
    if (id.startsWith('armory:equip:')) {
      const data = box.data as { heroId: string; weaponId: string; equippedHere: boolean } | undefined;
      if (!data) return;
      const res = equipWeapon(this.profile, data.heroId, data.equippedHere ? null : data.weaponId);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.platform.audio.play('merge_upgrade');
        this.showToast(t(res.key), 'good', 1.6);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id.startsWith('armory:recycle-toggle:')) {
      const rarity = Number(id.slice('armory:recycle-toggle:'.length));
      if (this.armory.recycleRarities.includes(rarity)) {
        this.armory.recycleRarities = this.armory.recycleRarities.filter(r => r !== rarity);
      } else {
        this.armory.recycleRarities = [...this.armory.recycleRarities, rarity].sort();
      }
      return;
    }
    if (id === 'armory:recycle') {
      const res = recycleFragments(this.profile, this.armory.recycleRarities);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.platform.audio.play('coin');
        this.showToast(zh ? `♻ 分解获得 +${res.amount ?? 0} 金币！` : `♻ Recycled for +${res.amount ?? 0} coins!`, 'good', 2.2);
      }
      return;
    }

    // ── Hub #2: Raccoon Market (Shop / Backpack / Lucky Gacha) ──────────────
    if (id.startsWith('market:tab:')) {
      this.market.tab = id.slice('market:tab:'.length) as MarketState['tab'];
      this.scroll.reset();
      return;
    }
    if (id === 'market:merchant') {
      this.market.merchantQuip = (this.market.merchantQuip + 1) % 3;
      return;
    }
    if (id.startsWith('market:buy:')) {
      const propId = id.slice('market:buy:'.length);
      const res = buyProp(this.profile, propId);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.platform.audio.play('coin');
        this.showToast(zh ? `🛍️ 已购入「${PROPS[propId]?.name['zh-CN']}」！` : `🛍️ Bought ${PROPS[propId]?.name.en}!`, 'good', 2.0);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id === 'market:refresh') {
      const res = refreshShop(this.profile, localDay(), Math.random);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.showToast(zh ? '🔄 货摊已刷新！' : '🔄 Shop refreshed!', 'good', 1.6);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id === 'market:ad-refresh') {
      void this.runRewardedAd('free_shop_refresh', () => {
        const freeTemp = { ...this.profile, coins: this.profile.coins + 40 };
        const res = refreshShop(freeTemp, localDay(), Math.random);
        if (res.ok) {
          this.profile = res.profile;
          this.save();
          this.showToast(zh ? '🎬 免费刷新成功！' : '🎬 Free shop refresh!', 'good', 2.0);
        }
      });
      return;
    }
    if (id === 'market:spin' || id.startsWith('market:spin:')) {
      const rawPay = id.startsWith('market:spin:') ? id.slice('market:spin:'.length) : 'auto';
      const pay = (rawPay === 'ticket' || rawPay === 'coins' ? rawPay : 'auto') as 'auto' | 'ticket' | 'coins';
      const res = spinLottery(this.profile, this.market.prizes, Math.random, pay);
      if (res.ok && res.prize) {
        this.profile = res.profile;
        this.save();
        this.market.lastPrizeIndex = res.index ?? null;
        this.market.lastPrizeLabel = this.formatPrizeLabel(res.prize);
        this.market.spunThisVisit = true;
        this.market.prizes = createLotteryPrizes(this.profile, Math.random);
        this.platform.audio.play('gacha_win');
        this.showToast(`🎉 ${this.market.lastPrizeLabel}`, 'good', 2.6);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id === 'market:ad-gacha') {
      void this.runRewardedAd('free_gacha', () => {
        const temp = { ...this.profile, freeLotteryTickets: this.profile.freeLotteryTickets + 1 };
        const res = spinLottery(temp, this.market.prizes, Math.random, 'ticket');
        if (res.ok && res.prize) {
          this.profile = res.profile;
          this.save();
          this.market.lastPrizeIndex = res.index ?? null;
          this.market.lastPrizeLabel = this.formatPrizeLabel(res.prize);
          this.market.spunThisVisit = true;
          this.market.prizes = createLotteryPrizes(this.profile, Math.random);
          this.platform.audio.play('gacha_win');
          this.showToast(`🎬 🎉 ${this.market.lastPrizeLabel}`, 'good', 2.6);
        }
      });
      return;
    }
    if (id.startsWith('market:equip:')) {
      const propId = id.slice('market:equip:'.length);
      const res = equipProp(this.profile, propId);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.showToast(t(res.key), 'good', 1.6);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }

    // ── Hub #3: Capybara Onsen Village ──────────────────────────────────────
    if (id === 'village:tab:courtyard' || id === 'village:tab:build') {
      this.villageUi.tab = id === 'village:tab:courtyard' ? 'courtyard' : 'build';
      if (this.villageUi.tab === 'courtyard') this.villageUi.focusFacilityId = null;
      this.scroll.reset();
      return;
    }
    if (id.startsWith('village:focus:')) {
      const facId = id.slice('village:focus:'.length);
      if (isFacilityId(facId)) {
        this.villageUi.tab = 'build';
        this.villageUi.focusFacilityId = facId;
        this.scroll.reset();
      }
      return;
    }
    if (id.startsWith('village:pet:')) {
      const raw = id.slice('village:pet:'.length);
      const residents = getVillageResidents(this.profile);
      const parsedIdx = Number(raw);
      const petIdx = Number.isInteger(parsedIdx) && parsedIdx >= 0 && parsedIdx < residents.length ? parsedIdx : 0;
      const petId = residents[petIdx]?.id ?? raw;
      const res = petVillageResident(this.profile, petId, localDay());
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.villageUi.interacted = true;
        const quote = t(`p16.quote.${Math.floor(Math.random() * PET_QUOTE_COUNT)}`);
        this.villageUi.petFeedback = { petIndex: petIdx, quote, coins: res.coins, until: this.elapsedSec + 2.2 };
        if (res.coins > 0) {
          this.platform.audio.play('coin');
          this.showToast(`🐾 ${quote} +${res.coins}`, 'good', 1.8);
        } else {
          this.showToast(`🐾 ${quote}`, 'info', 1.6);
        }
      }
      return;
    }
    if (id === 'village:harvest') {
      const res = claimOfflineHarvest(this.profile, Date.now(), Math.random);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.villageUi.interacted = true;
        this.platform.audio.play('coin');
        this.showToast(zh ? `🧺 收菜成功！🪙+${res.harvest.coins}` : `🧺 Collected! 🪙+${res.harvest.coins}`, 'good', 2.2);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id === 'village:ad-harvest') {
      void this.runRewardedAd('double_harvest', () => {
        const res = claimOfflineHarvest(this.profile, Date.now(), Math.random);
        if (res.ok) {
          this.profile = { ...res.profile, coins: res.profile.coins + res.harvest.coins };
          this.save();
          this.villageUi.interacted = true;
          this.platform.audio.play('gacha_win');
          this.showToast(zh ? `🎬 双倍收菜成功！🪙+${res.harvest.coins * 2}` : `🎬 2× Harvest! 🪙+${res.harvest.coins * 2}`, 'good', 2.4);
        }
      });
      return;
    }
    if (id.startsWith('village:build:')) {
      const facId = id.slice('village:build:'.length);
      const res = buildFacility(this.profile, facId);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        if (isFacilityId(facId)) this.villageUi.focusFacilityId = facId;
        this.platform.audio.play('merge_hero');
        this.showToast(zh ? `🏗️ ${t(`facility.${facId}`)} 升至 Lv.${res.level}！` : `🏗️ ${t(`facility.${facId}`)} Lv.${res.level}!`, 'good', 2.2);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }

    // ── Hub #4: Onsen Kitchen (Broths + Dish Detail + Ingredient Pantry) ────
    if (id.startsWith('kitchen:tab:')) {
      this.kitchenUi.tab = id.slice('kitchen:tab:'.length) as KitchenUiState['tab'];
      this.kitchenUi.detailBrothId = null;
      this.scroll.reset();
      return;
    }
    if (id.startsWith('kitchen:dish:')) {
      this.kitchenUi.detailBrothId = id.slice('kitchen:dish:'.length) as BrothId;
      this.scroll.reset();
      return;
    }
    if (id === 'kitchen:back') {
      this.kitchenUi.detailBrothId = null;
      this.scroll.reset();
      return;
    }
    if (id === 'kitchen:prev' || id === 'kitchen:next') {
      if (this.kitchenUi.detailBrothId) {
        const cur = BROTH_IDS.indexOf(this.kitchenUi.detailBrothId);
        const step = id === 'kitchen:next' ? 1 : -1;
        this.kitchenUi.detailBrothId = BROTH_IDS[(cur + step + BROTH_IDS.length) % BROTH_IDS.length];
        this.scroll.reset();
      }
      return;
    }
    if (id === 'kitchen:unequip') {
      const res = equipBroth(this.profile, null);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.showToast(zh ? '已切回清泉水' : 'Back to clear spring', 'good', 1.6);
      }
      return;
    }
    if (id === 'kitchen:basket') {
      const res = buyIngredientBasket(this.profile, Math.random);
      if (res.ok && res.gained) {
        this.profile = res.profile;
        this.save();
        this.kitchenUi.lastBasketGained = [...res.gained];
        this.platform.audio.play('coin');
        const names = res.gained.map(g => t(`ingredient.${g}`)).join('、');
        this.showToast(`🧺 ${names}`, 'good', 2.6);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id.startsWith('kitchen:brew:')) {
      const bid = id.slice('kitchen:brew:'.length);
      const res = brewBroth(this.profile, bid);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.platform.audio.play('merge_hero');
        this.showToast(zh ? `🍲 成功熬制「${t(`broth.${bid}`)}」！` : `🍲 Brewed ${t(`broth.${bid}`)}!`, 'good', 2.2);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id.startsWith('kitchen:upgrade:')) {
      const bid = id.slice('kitchen:upgrade:'.length);
      const res = upgradeBroth(this.profile, bid);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.platform.audio.play('merge_upgrade');
        this.showToast(zh ? `✨ ${t(`broth.${bid}`)} 升至 Lv.${res.level}！` : `✨ ${t(`broth.${bid}`)} Lv.${res.level}!`, 'good', 2.0);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id.startsWith('kitchen:equip:')) {
      const bid = id.slice('kitchen:equip:'.length) as Parameters<typeof equipBroth>[1];
      const res = equipBroth(this.profile, bid);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.showToast(
          this.profile.activeBrothId ? (zh ? `♨️ 今日汤底：${t(`broth.${this.profile.activeBrothId}`)}` : `♨️ Active: ${t(`broth.${this.profile.activeBrothId}`)}`) : (zh ? '已切回清泉水' : 'Back to clear spring'),
          'good',
          1.8,
        );
      }
      return;
    }

    // ── Hub #5: Endless Medallions (2 Tabs: Medallions + Global Endless Board) ──
    if (id.startsWith('medallion:tab:')) {
      this.leaderboardUi.medallionTab = id.slice('medallion:tab:'.length) as MedallionHubTab;
      this.scroll.reset();
      if (this.leaderboardUi.medallionTab === 'endless-board') void this.refreshLeaderboards(false);
      return;
    }
    if (id.startsWith('medallion:up:')) {
      const mid = id.slice('medallion:up:'.length);
      const res = upgradeMedallion(this.profile, mid);
      if (res.ok) {
        this.profile = res.profile;
        this.save();
        this.platform.audio.play('merge_hero');
        this.showToast(zh ? `✨ 勋章强化至 Lv.${res.level}！` : `✨ Medallion Lv.${res.level}!`, 'good', 1.8);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }

    // ── Hub #6 & #7: Unified 4-Tab Profile Wood Book (Rank / Endless / Passport / Settings) ──
    if (id.startsWith('profilehub:tab:')) {
      const nextTab = id.slice('profilehub:tab:'.length) as ProfileHubTab;
      this.modal = nextTab;
      this.leaderboardUi.showRankLadder = false;
      this.scroll.reset();
      if (nextTab === 'leaderboard' || nextTab === 'endless-board') {
        void this.refreshLeaderboards(false);
      }
      return;
    }
    if (id === 'lb:toggle-ladder') {
      this.leaderboardUi.showRankLadder = !this.leaderboardUi.showRankLadder;
      this.scroll.reset();
      return;
    }
    if (id === 'lb:refresh') {
      void this.refreshLeaderboards(true);
      return;
    }
    if (id === 'lb:rename' || id === 'profile:rename') {
      void this.promptNicknameEdit();
      return;
    }
    if (id.startsWith('profile:avatar:')) {
      const data = box.data as { id: string; unlocked: boolean; desc: string } | undefined;
      if (!data) return;
      if (data.unlocked) {
        this.profile = selectAvatar(this.profile, data.id);
        this.save();
        this.showToast(zh ? '💮 头像已更换！' : '💮 Avatar updated!', 'good', 1.6);
      } else {
        this.showToast(`🔒 ${data.desc}`, 'warn', 2.4);
      }
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
      if (this.engine?.state.phase === 'playing') this.engine.pause(true);
      this.openModal('recipes');
      this.advanceBattleTutorial('open-compendium');
      return;
    }
    if (id === 'battle:shop') {
      if (this.engine?.state.phase === 'playing') this.engine.pause(true);
      this.openModal(isFeatureUnlocked(this.profile, 'market') ? 'market' : 'armory');
      return;
    }
    if (id === 'battle:backpack') {
      if (this.engine?.state.phase === 'playing') this.engine.pause(true);
      this.market.tab = 'backpack';
      this.openModal('market');
      return;
    }
    if (id === 'battle:pause') {
      if (this.engine?.state.phase === 'playing') this.engine.pause(true);
      this.openModal('pause');
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
    if (id === 'battle:skip-curtain') { this.curtainRemaining = 0; return; }
    if (id === 'battle:cancel-mode') { this.activePropId = undefined; this.shovelSelected = false; return; }
    if (id.startsWith('battle:passive:')) {
      const pid = id.slice('battle:passive:'.length);
      this.expandedPassiveId = this.expandedPassiveId === pid ? undefined : pid;
      return;
    }
    if (id === 'battle:tutorial-skip') { this.advanceBattleTutorial('skip'); return; }
    if (id === 'battle:tutorial-ack') { this.advanceBattleTutorial('acknowledge'); return; }

    // ── Battle Modal / Settlement / Ad / Share Actions ──────────────────────
    if (id === 'modal:resume') { this.resumeBattle(); return; }
    if (id === 'modal:close') { this.closeOverlayModal(); return; }
    if (id === 'modal:surrender' && this.engine) {
      this.modal = null;
      this.engine.surrender();
      if (this.engine.state.result) this.handleBattleFinished(this.engine.state);
      return;
    }
    if (id === 'modal:decline-endless') { this.modal = 'result'; return; }
    if (id === 'modal:enter-endless' && this.engine) {
      const res = this.engine.enterEndless();
      if (res.ok) {
        this.modal = null;
        this.platform.audio.play('wave_start');
        if (!hasOnboarded(this.profile, 'endless_battle')) {
          this.battleLesson = 'endless_battle';
          this.engine.pause(true);
          this.modal = 'battle-lesson';
        } else {
          this.showToast(zh ? '♾️ 无尽模式开启！第 11 波来袭！' : '♾️ Endless Mode started! Wave 11!', 'good', 2.6);
        }
      }
      return;
    }
    if (id === 'modal:toggle-stats') { this.settlement.statsOpen = !this.settlement.statsOpen; return; }
    if (id === 'result:share' && this.engine?.state.result) {
      const r = this.engine.state.result;
      this.platform.share(buildSharePayload(this.profile, r.endless ? 'endless' : 'victory', r.endlessWave));
      this.showToast(zh ? '📤 已唤起战绩分享卡片！' : '📤 Share card opened!', 'good', 1.8);
      return;
    }
    if (id === 'result:ad-double' && this.engine?.state.result && !this.settlement.adDoubleClaimed) {
      const st = this.engine.state;
      const r = st.result!;
      const bonus = r.endless && st.standardResult ? st.standardResult.coins + (r.endlessCoins ?? 0) : r.coins;
      void this.runRewardedAd('double_settlement', () => {
        if (this.settlement.adDoubleClaimed) return;
        this.settlement.adDoubleClaimed = true;
        this.profile = { ...this.profile, coins: this.profile.coins + bonus };
        this.save();
        this.platform.audio.play('gacha_win');
        this.showToast(zh ? `🎬 双倍领奖成功！额外 +${bonus} 金币` : `🎬 2× Bonus! +${bonus} coins`, 'good', 2.4);
      });
      return;
    }
    if (id === 'result:ad-revive' && this.engine && !this.reviveUsedThisBattle) {
      void this.runRewardedAd('revive', () => {
        if (!this.engine || this.reviveUsedThisBattle) return;
        this.reviveUsedThisBattle = true;
        const st = this.engine.state;
        st.result = null;
        st.phase = 'playing';
        st.sides.player.oranges = 2;
        for (const en of st.enemies) this.engine.knockback(en, 3.5);
        this.modal = null;
        this.platform.audio.play('sprinkler');
        this.showToast(zh ? '🎬 紧急复活成功！+2 橘子并全路击退！' : '🎬 Revived! +2 Oranges & lane knockback!', 'good', 2.6);
      });
      return;
    }
    if (id === 'modal:again') { this.modal = null; void this.startBattle(); return; }
    if (id === 'modal:menu') { this.returnToMenu(); return; }
    if (id === 'settings:damage') {
      this.profile = updateSettings(this.profile, { showDamageNumbers: !this.profile.settings.showDamageNumbers });
      this.save();
      return;
    }
    if (id === 'settings:replay-tutorial') {
      this.profile = replayTutorial(this.profile);
      this.save();
      this.modal = null;
      void this.startBattle({ freeStamina: true });
      return;
    }
    if (id === 'settings:title-tap') {
      const now = Date.now();
      this.devTapCount = now - this.devTapLastAt < 2500 ? this.devTapCount + 1 : 1;
      this.devTapLastAt = now;
      if (this.devTapCount >= 5) {
        this.devUnlocked = true;
        this.devTapCount = 0;
        this.showToast(zh ? '🧪 开发者调试模式已开启！' : '🧪 Developer QA mode unlocked!', 'good', 2.2);
      }
      return;
    }
    if (id === 'settings:open-dev') {
      this.openModal('dev', this.modalReturnTo);
      return;
    }

    // ── Hidden Developer QA Modal Actions ───────────────────────────────────
    if (id.startsWith('dev:stage:')) {
      this.jumpToOnboardingStage(Number(id.slice('dev:stage:'.length)));
      return;
    }
    if (id === 'dev:unlock-all') { this.applyDevUnlockAll(); return; }
    if (id === 'dev:restore') { this.applyDevRestore(); return; }
    if (id === 'dev:reset') { this.applyDevReset(); return; }
    if (id === 'dev:add-coins') {
      this.profile = { ...this.profile, coins: this.profile.coins + 5000 };
      this.save();
      this.platform.audio.play('coin');
      this.showToast('🪙 +5000', 'good', 1.6);
      return;
    }
    if (id === 'dev:battle-food' && this.engine) {
      this.engine.pause(false);
      this.engine.addFood(500);
      this.engine.pause(true);
      this.showToast(t('hint.foodAdded'), 'good', 1.6);
      return;
    }
    if (id === 'dev:battle-skip' && this.engine) {
      this.modal = null;
      this.modalReturnTo = null;
      this.engine.pause(false);
      this.engine.skipWave();
      if (this.engine.state.result) this.handleBattleFinished(this.engine.state);
      else this.showToast(t('hint.waveSkipped'), 'good', 1.8);
      return;
    }
    if (id === 'dev:battle-orange-up' && this.engine) {
      this.engine.pause(false);
      this.engine.adjustOranges(1);
      this.engine.pause(true);
      return;
    }
    if (id === 'dev:battle-orange-down' && this.engine) {
      this.engine.pause(false);
      this.engine.adjustOranges(-1);
      if (this.engine.state.result) this.handleBattleFinished(this.engine.state);
      else this.engine.pause(true);
    }
  }

  private resumeBattle(): void {
    this.modal = null;
    this.modalReturnTo = null;
    if (this.engine?.state.phase === 'paused') {
      this.engine.pause(false);
    }
  }

  private closeOverlayModal(): void {
    if (this.activeGuideFeature) {
      this.profile = markOnboarded(this.profile, this.activeGuideFeature);
      this.save();
      this.activeGuideFeature = null;
    }
    if (this.modalReturnTo) {
      const back = this.modalReturnTo;
      this.modalReturnTo = null;
      this.modal = back;
      this.scroll.reset();
      return;
    }
    if (this.screen === 'battle' && this.engine?.state.phase === 'paused') {
      this.resumeBattle();
      return;
    }
    this.modal = null;
    this.checkMenuOnboarding();
  }

  private returnToMenu(): void {
    this.screen = 'menu';
    this.modal = null;
    this.modalReturnTo = null;
    this.engine = null;
    this.selectedId = undefined;
    this.shovelSelected = false;
    this.activePropId = undefined;
    this.expandedPassiveId = undefined;
    this.tutorialStep = 'done';
    this.curtainRemaining = 0;
    this.drag = undefined;
    this.checkMenuOnboarding();
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
        // Always clear selection after deploying, moving, upgrading, or merging a pet so the upgraded pet is NEVER auto-selected.
        this.selectedId = undefined;
      } else {
        this.showToast(t(res.key), 'warn', 1.6);
      }
    } else if (target) {
      this.selectedId = moved ? undefined : (this.selectedId === target.id ? undefined : target.id);
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
    setMobileWideStage(false);
  }
}

export { ECONOMY };
