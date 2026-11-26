import { BattleEngine } from '../core/BattleEngine';
import { HEROES } from '../config/heroes';
import { BROTH_IDS, INGREDIENT_BASKET_PRICE, type BrothId } from '../config/kitchen';
import { PROPS } from '../config/props';
import { getRank } from '../config/ranks';
import { getMap, setMobileWideStage, STAGE } from '../config/maps';
import { ECONOMY } from '../config/units';
import { isFacilityId } from '../config/village';
import { WEAPONS, rollWeapon } from '../config/weapons';
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
  grantIngredients,
  upgradeBroth,
} from '../core/KitchenProgression';
import { upgradeMedallion } from '../core/MedallionProgression';
import {
  buyProp,
  createLotteryPrizes,
  ensureDailyLottery,
  ensureDailyShop,
  equipProp,
  equipWeapon,
  grantWeaponFragments,
  recycleFragments,
  refreshShop,
  spinLottery,
  type LotteryPrize,
} from '../core/MetaProgression';
import { displayNickname, validateNickname } from '../core/PlayerIdentity';
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
  grantStamina,
  settleStamina,
  spendStamina,
} from '../core/Stamina';
import { advanceTutorial, finishTutorial, replayTutorial, type TutorialStep } from '../core/Tutorial';
import {
  buildFacility,
  claimOfflineHarvest,
  computeOfflineHarvest,
  getVillageResidents,
  grantVillageResources,
  hasHarvest,
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
import { BATTLE_SPEED_BASELINE, nextBattleSpeed } from '../ui/P13HUD';
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
  canUseAdToday,
  getAdUnitId,
  isAdPlacementAvailable,
  recordAdUse,
  type AdPlacement,
} from './adConfig';
import { buildFriendCloudPayload } from './friendCloud';
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
  private scrollingWxFriend = false;
  private wxFriendLastY = 0;
  private wxFriendMoved = false;
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
  private speed3xTrialThisBattle = false;
  private preDefeatProfile: Profile | null = null;
  private adInFlight = false;
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
    const bootDay = localDay();
    const prevLotteryDay = this.profile.lottery?.day;
    const prevShopDay = this.profile.shop?.day;
    this.profile = ensureDailyLottery(ensureDailyShop(this.profile, bootDay, Math.random), bootDay, Math.random);
    if (prevLotteryDay !== this.profile.lottery?.day || prevShopDay !== this.profile.shop?.day) {
      this.save();
    }
    this.platform.audio.setSettings(this.profile.settings);
    this.muted = this.profile.settings.musicVolume <= 0 && this.profile.settings.soundVolume <= 0;

    this.leaderboardClient = new EndlessLeaderboardClient({
      baseUrl: MINIGAME_LEADERBOARD_URL,
      fetch: platform.fetch,
      storage: platform.storage,
    });
    this.syncWxFriendCloud();

    this.market = {
      tab: 'shop',
      merchantQuip: 0,
      prizes: [...(this.profile.lottery?.prizes ?? createLotteryPrizes(this.profile, Math.random))],
      highlightIndex: null,
      lastPrizeIndex: null,
      lastPrizeLabel: '',
      spinAnim: null,
      celebrateUntil: 0,
      pendingRefreshAt: null,
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
    this.kitchenUi.adFreeBasketAvailable = isAdPlacementAvailable(platform.kind, 'free_basket');
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

  private syncDailyLottery(persistIfChanged = true): void {
    const today = localDay();
    const prevDay = this.profile.lottery?.day;
    this.profile = ensureDailyLottery(this.profile, today, Math.random);
    if (persistIfChanged && prevDay !== this.profile.lottery?.day) {
      this.save();
    }
  }

  private jumpToOnboardingStage(stage: number): void {
    const s = Math.max(0, Math.min(8, Math.trunc(stage)));
    const today = localDay();
    this.profile = buildDebugStageProfile(this.profile, s);
    this.profile = ensureDailyLottery(ensureDailyShop({ ...this.profile, stamina: STAMINA_MAX, staminaUpdatedAt: Date.now() }, today, Math.random), today, Math.random);
    this.market.prizes = [...this.profile.lottery!.prizes];
    this.save();
    this.returnToMenu();
    this.showToast(t('p19.devStageDone', { stage: s }), 'good', 2.6);
  }

  private applyDevUnlockAll(): void {
    const today = localDay();
    this.profile = enableTestProfile(this.platform.storage);
    this.profile = ensureDailyLottery(ensureDailyShop({ ...this.profile, stamina: STAMINA_MAX, staminaUpdatedAt: Date.now() }, today, Math.random), today, Math.random);
    this.market.prizes = [...this.profile.lottery!.prizes];
    this.save();
    this.returnToMenu();
    this.showToast(getLanguage() === 'zh-CN' ? '🌟 已开启全解锁测试档！' : '🌟 Full unlock test save enabled!', 'good', 2.4);
  }

  private applyDevRestore(): void {
    const today = localDay();
    this.profile = restoreNormalProfile(this.platform.storage);
    this.profile = ensureDailyLottery(ensureDailyShop(this.profile, today, Math.random), today, Math.random);
    this.market.prizes = [...this.profile.lottery!.prizes];
    this.save();
    this.returnToMenu();
    this.showToast(getLanguage() === 'zh-CN' ? '↩ 已恢复正式存档！' : '↩ Restored normal save!', 'good', 2.4);
  }

  private applyDevReset(): void {
    const today = localDay();
    resetOwnStorage(this.platform.storage);
    this.profile = ensureDailyLottery(ensureDailyShop(emptyProfile(), today, Math.random), today, Math.random);
    this.market.prizes = [...this.profile.lottery!.prizes];
    this.save();
    this.returnToMenu();
    this.showToast(t('hint.reset'), 'warn', 2.2);
  }

  private syncViewport(vp: ViewportMetrics): void {
    this.renderer.setViewportTransform(vp.stageScale, vp.stageOffsetX, vp.stageOffsetY);
  }

  private save(): void {
    saveProfile(this.profile, this.platform.storage);
    if (this.screen === 'battle' && this.engine?.canSyncPreparationLoadout()) {
      this.engine.syncPreparationLoadout(villageLoadout(this.profile));
    }
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
      const today = localDay();
      const prevShopDay = this.profile.shop?.day;
      const prevLotDay = this.profile.lottery?.day;
      this.profile = ensureDailyLottery(ensureDailyShop(this.profile, today, Math.random), today, Math.random);
      if (prevShopDay !== this.profile.shop?.day || prevLotDay !== this.profile.lottery?.day) {
        this.save();
      }
      this.market.spunThisVisit = false;
      this.market.spinAnim = null;
      this.market.pendingRefreshAt = null;
      this.market.prizes = [...this.profile.lottery!.prizes];
      this.market.highlightIndex = null;
      this.market.lastPrizeIndex = null;
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

  private syncWxFriendCloud(): void {
    const entries = buildFriendCloudPayload(this.profile, getLanguage());
    if (entries.length > 0) {
      this.platform.setFriendCloudStorage?.(entries);
    }
  }

  private renderWxFriendBoard(board: 'rank' | 'endless', force = false): void {
    const canvas = this.platform.getFriendLeaderboardCanvas?.();
    if (!canvas) return;
    // Main domain sizes sharedCanvas once at 1.5× Retina sharpness for our 1140×360 viewport box.
    if (canvas.width !== 1710) canvas.width = 1710;
    if (canvas.height !== 540) canvas.height = 540;
    const lang = getLanguage();
    const rank = getRank(this.profile.stars);
    this.platform.postFriendLeaderboardMessage?.({
      type: 'render',
      board,
      lang,
      force,
      selfFallback: {
        nickname: displayNickname(this.profile, lang),
        stars: this.profile.stars,
        rankName: t(`rank.${rank.index}`),
        wins: this.profile.wins,
        bestWave: this.profile.bestEndlessWave ?? 0,
      },
    });
  }

  private clearWxFriendBoard(): void {
    this.platform.postFriendLeaderboardMessage?.({ type: 'clear' });
  }

  private async refreshLeaderboards(force: boolean): Promise<void> {
    this.leaderboardUi.loading = true;
    try {
      const lang = getLanguage();
      this.syncWxFriendCloud();
      const activeBoard: 'rank' | 'endless' = (
        this.modal === 'endless-board' || (this.modal === 'medallions' && this.leaderboardUi.medallionTab === 'endless-board')
      ) ? 'endless' : 'rank';
      this.renderWxFriendBoard(activeBoard, force);
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
    if (this.adInFlight) return;
    const day = localDay();
    if (!canUseAdToday(this.profile, placement, day)) {
      this.showToast(
        getLanguage() === 'zh-CN' ? '今日该奖励次数已用完，明天再来吧' : 'Daily limit reached — come back tomorrow!',
        'warn',
        2.0,
      );
      return;
    }
    this.adInFlight = true;
    const pausedForAd = this.engine?.state.phase === 'playing';
    if (pausedForAd) this.engine?.pause(true);
    try {
      const unitId = getAdUnitId(this.platform.kind, placement);
      const outcome = await this.platform.showRewardedAd(unitId);
      // STRICT completion check: ONLY grant reward when full video finished (`outcome === 'completed'`).
      // Closing early (`skipped`) or error (`unavailable`) NEVER grants any bonus or consumes daily quota!
      if (outcome === 'completed') {
        if (canUseAdToday(this.profile, placement, localDay())) {
          onReward();
        }
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
    } finally {
      this.adInFlight = false;
      if (pausedForAd && this.engine?.state.phase === 'paused' && !this.modal) {
        this.engine.pause(false);
      }
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
    this.tickGachaSpin(rawDt);
    this.scroll.tick(rawDt);

    if (this.screen === 'battle' && this.engine && this.engine.state.phase === 'playing' && !this.modal) {
      this.engine.tick(rawDt * BATTLE_SPEED_BASELINE * this.speed);
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
          this.syncWxFriendCloud();
          void this.leaderboardClient.submitScore(this.profile, getLanguage());
        }
      }
      this.modal = 'result';
      return;
    }

    if (!this.profile.awardedBattles.includes(state.id)) {
      const canReviveDefeat = result.winner !== 'player'
        && result.reason === 'oranges'
        && !this.reviveUsedThisBattle
        && isAdPlacementAvailable(this.platform.kind, 'revive');
      this.preDefeatProfile = canReviveDefeat ? (JSON.parse(JSON.stringify(this.profile)) as Profile) : null;
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
          adReviveAvailable: canReviveDefeat,
        };
        this.platform.audio.play(result.winner === 'player' ? 'victory' : 'defeat');
        this.syncWxFriendCloud();
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
          selectedId: this.selectedId,
          shovelSelected: this.shovelSelected,
          activePropId: this.activePropId,
          expandedPassiveId: this.expandedPassiveId,
          highlightPropId: this.modal === 'battle-lesson' && this.battleLesson === 'prop_battle' ? 'glue_trap' : undefined,
          tutorialStep: this.tutorialStep,
          topRightEdge: topRight,
          viewport: vp,
          curtainRemaining: this.curtainRemaining,
          speed3xTrialActive: this.speed3xTrialThisBattle,
          adSpeed3xAvailable: isAdPlacementAvailable(this.platform.kind, 'speed3x_trial'),
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
        adSpeed3xAvailable: isAdPlacementAvailable(this.platform.kind, 'speed3x_trial'),
        speed3xTrialActive: this.speed3xTrialThisBattle,
        wxFriendCanvas: this.platform.getFriendLeaderboardCanvas?.() ?? null,
        wxFriendMode: this.platform.kind === 'wx' && Boolean(this.platform.getFriendLeaderboardCanvas?.()),
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
    this.speed3xTrialThisBattle = false;
    this.preDefeatProfile = null;
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
    if (next === 7 || next === 'done') {
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
    this.scrollingWxFriend = false;
    this.wxFriendMoved = false;
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
      const wfv = this.modalLayout.wxFriendViewport;
      if (wfv && p.stageX >= wfv.x && p.stageX <= wfv.x + wfv.w && p.stageY >= wfv.y && p.stageY <= wfv.y + wfv.h) {
        this.scrollingWxFriend = true;
        this.wxFriendLastY = p.stageY;
        this.wxFriendMoved = false;
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
    if (this.scrollingWxFriend) {
      const dy = this.wxFriendLastY - p.stageY;
      this.wxFriendLastY = p.stageY;
      if (Math.abs(dy) > 1) {
        this.wxFriendMoved = true;
        this.hits.activeId = null;
        this.platform.postFriendLeaderboardMessage?.({ type: 'scrollDelta', dy });
      }
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

    if (this.scrollingWxFriend) {
      const wasScroll = this.wxFriendMoved;
      this.scrollingWxFriend = false;
      this.wxFriendMoved = false;
      if (wasScroll) { this.hits.activeId = null; return; }
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
      const wName = zh ? WEAPONS[prize.id].name['zh-CN'] : WEAPONS[prize.id].name.en;
      return zh ? `🧩 ${wName} 碎片 ×${prize.amount}` : `🧩 ${wName} Frag ×${prize.amount}`;
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
      if (!this.muted) this.platform.audio.unlock();
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
      if (this.market.spinAnim) return;
      this.syncDailyLottery();
      if (this.market.pendingRefreshAt !== null) {
        this.market.prizes = [...this.profile.lottery!.prizes];
        this.market.pendingRefreshAt = null;
      }
      const rawPay = id.startsWith('market:spin:') ? id.slice('market:spin:'.length) : 'auto';
      const pay = (rawPay === 'ticket' || rawPay === 'coins' ? rawPay : 'auto') as 'auto' | 'ticket' | 'coins';
      const res = spinLottery(this.profile, this.market.prizes, Math.random, pay, localDay());
      if (res.ok && res.prize) {
        this.profile = res.profile;
        this.save();
        const label = this.formatPrizeLabel(res.prize);
        this.startGachaSpin(res.index ?? 0, label, `🎉 ${label}`);
      } else {
        this.showToast(t(res.key), 'warn', 1.8);
      }
      return;
    }
    if (id === 'market:ad-gacha') {
      if (this.market.spinAnim) return;
      void this.runRewardedAd('free_gacha', () => {
        const day = localDay();
        this.syncDailyLottery();
        if (this.market.pendingRefreshAt !== null) {
          this.market.prizes = [...this.profile.lottery!.prizes];
          this.market.pendingRefreshAt = null;
        }
        const temp = { ...this.profile, freeLotteryTickets: this.profile.freeLotteryTickets + 1 };
        const res = spinLottery(temp, this.market.prizes, Math.random, 'ticket', day);
        if (res.ok && res.prize) {
          this.profile = recordAdUse(res.profile, 'free_gacha', day);
          this.save();
          const label = this.formatPrizeLabel(res.prize);
          this.startGachaSpin(res.index ?? 0, label, `🎬 🎉 ${label}`);
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
      if (!hasHarvest(computeOfflineHarvest(this.profile, Date.now()))) return;
      void this.runRewardedAd('double_harvest', () => {
        const now = Date.now();
        const day = localDay();
        const res = claimOfflineHarvest(this.profile, now, Math.random);
        if (res.ok) {
          let next = {
            ...res.profile,
            coins: res.profile.coins + res.harvest.coins,
            freeLotteryTickets: res.profile.freeLotteryTickets + res.harvest.tickets,
          };
          if (res.harvest.yuzu > 0) {
            next = grantIngredients(next, Array.from({ length: res.harvest.yuzu }, () => 'ing_yuzu'));
          }
          if (res.harvest.fragments > 0) {
            const extraFrags = grantWeaponFragments(
              next,
              Array.from({ length: res.harvest.fragments }, () => rollWeapon(Math.random, undefined, 1, next.unlockedWeapons)),
            );
            next = { ...extraFrags.profile, village: next.village };
          }
          this.profile = recordAdUse(next, 'double_harvest', day);
          this.save();
          this.villageUi.interacted = true;
          this.platform.audio.play('gacha_win');
          const parts: string[] = [];
          if (res.harvest.coins > 0) parts.push(`🪙+${res.harvest.coins * 2}`);
          if (res.harvest.yuzu > 0) parts.push(`🍊+${res.harvest.yuzu * 2}`);
          if (res.harvest.fragments > 0) parts.push(`🗡️+${res.harvest.fragments * 2}`);
          if (res.harvest.tickets > 0) parts.push(`🎟️+${res.harvest.tickets * 2}`);
          this.showToast(zh ? `🎬 双倍领取成功！${parts.join(' ')}` : `🎬 2× Harvest! ${parts.join(' ')}`, 'good', 2.6);
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
    if (id === 'kitchen:ad-basket') {
      void this.runRewardedAd('free_basket', () => {
        const day = localDay();
        const temp = { ...this.profile, coins: this.profile.coins + INGREDIENT_BASKET_PRICE };
        const res = buyIngredientBasket(temp, Math.random);
        if (res.ok && res.gained) {
          this.profile = recordAdUse(res.profile, 'free_basket', day);
          this.save();
          this.kitchenUi.lastBasketGained = [...res.gained];
          this.platform.audio.play('gacha_win');
          const names = res.gained.map(g => t(`ingredient.${g}`)).join('、');
          this.showToast(zh ? `🎬 免费食材篮：${names}` : `🎬 Free Basket: ${names}`, 'good', 2.6);
        }
      });
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
      if (!this.leaderboardUi.showRankLadder) {
        this.renderWxFriendBoard('rank', false);
      }
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
      const maxSpd = this.speed3xTrialThisBattle ? 3 : maxBattleSpeed(this.profile);
      if (maxSpd <= 1) {
        const need = Math.max(1, 2 - Math.max(this.profile.stars, this.profile.highestStars));
        this.showToast(t('p19.lockedToast', { name: t('p19.feature.speed2x'), stars: 2, need }), 'warn', 2.2);
      } else {
        this.speed = nextBattleSpeed(this.speed, maxSpd);
      }
      return;
    }
    if (id === 'battle:speed3x-trial') {
      if (this.speed3xTrialThisBattle || maxBattleSpeed(this.profile) >= 3) return;
      if (this.engine?.state.phase === 'playing') this.engine.pause(true);
      this.openModal('speed3x-trial');
      return;
    }
    if (id === 'battle:ad-speed3x') {
      if (this.speed3xTrialThisBattle || maxBattleSpeed(this.profile) >= 3) return;
      void this.runRewardedAd('speed3x_trial', () => {
        this.profile = recordAdUse(this.profile, 'speed3x_trial', localDay());
        this.save();
        this.speed3xTrialThisBattle = true;
        this.speed = 3;
        this.resumeBattle();
        this.platform.audio.play('gacha_win');
        this.showToast(zh ? '🎬 3× 极速已开启（本局生效）！' : '🎬 3× Speed unlocked for this battle!', 'good', 2.4);
      });
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
      const bonusCoins = r.endless && st.standardResult ? st.standardResult.coins + (r.endlessCoins ?? 0) : r.coins;
      const bonusLoot = r.endless && st.standardResult ? [...st.standardResult.loot, ...(r.endlessLoot ?? [])] : [...r.loot];
      const bonusIngredients = r.endless && st.standardResult
        ? [...(st.standardResult.ingredientLoot ?? []), ...(r.endlessIngredientLoot ?? [])]
        : [...(r.ingredientLoot ?? [])];
      const bonusVillage = r.endless && st.standardResult
        ? [...(st.standardResult.villageLoot ?? []), ...(r.endlessVillageLoot ?? [])]
        : [...(r.villageLoot ?? [])];
      const bonusCrests = r.endless && st.standardResult
        ? (st.standardResult.endlessCrests ?? 0) + (r.endlessCrests ?? 0)
        : (r.endlessCrests ?? 0);
      void this.runRewardedAd('double_settlement', () => {
        if (this.settlement.adDoubleClaimed) return;
        this.settlement.adDoubleClaimed = true;
        const day = localDay();
        let next = this.profile;
        if (bonusLoot.length > 0) {
          const granted = grantWeaponFragments(next, bonusLoot);
          next = granted.profile;
          if (granted.newWeapons.length > 0) {
            this.settlement.newWeapons = [...new Set([...this.settlement.newWeapons, ...granted.newWeapons])];
          }
        }
        if (bonusIngredients.length > 0) {
          next = grantIngredients(next, bonusIngredients);
        }
        if (bonusVillage.length > 0) {
          next = grantVillageResources(next, bonusVillage);
        }
        next = {
          ...next,
          coins: next.coins + bonusCoins,
          endlessCrests: (next.endlessCrests ?? 0) + bonusCrests,
        };
        this.profile = recordAdUse(next, 'double_settlement', day);
        this.save();
        this.platform.audio.play('gacha_win');
        this.showToast(
          zh ? '🎬 双倍全奖励领取成功！金币/食材/材料/碎片/纹章全部 ×2！' : '🎬 2× All Rewards claimed!',
          'good',
          2.6,
        );
      });
      return;
    }
    if (id === 'result:ad-revive' && this.engine && !this.reviveUsedThisBattle) {
      void this.runRewardedAd('revive', () => {
        if (!this.engine || this.reviveUsedThisBattle) return;
        const revived = this.engine.reviveCurrentWave(3);
        if (!revived.ok) return;
        this.reviveUsedThisBattle = true;
        if (this.preDefeatProfile) {
          this.profile = this.preDefeatProfile;
          this.preDefeatProfile = null;
          this.save();
        }
        this.modal = null;
        this.modalReturnTo = null;
        this.platform.audio.play('sprinkler');
        this.showToast(
          zh ? `🎬 复活成功！恢复 3 颗橘子，重新开始第 ${revived.value ?? this.engine.state.wave} 波！` : `🎬 Revived! +3 Oranges — Wave ${revived.value ?? this.engine.state.wave} restarted!`,
          'good',
          2.6,
        );
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
        this.openModal('dev', this.modalReturnTo);
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
    if (id === 'dev:refill-stamina') {
      this.profile = { ...this.profile, stamina: STAMINA_MAX, staminaUpdatedAt: Date.now() };
      this.save();
      this.platform.audio.play('coin');
      this.showToast(zh ? `⚡ 体力已补满（${STAMINA_MAX}/${STAMINA_MAX}）` : `⚡ Energy full (${STAMINA_MAX}/${STAMINA_MAX})`, 'good', 1.8);
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

  private startGachaSpin(winnerIndex: number, label: string, toastText: string): void {
    const winner = ((winnerIndex % 8) + 8) % 8;
    const totalSteps = 24 + winner;
    this.market.spunThisVisit = true;
    this.market.lastPrizeIndex = null;
    this.market.lastPrizeLabel = '';
    this.market.highlightIndex = 0;
    this.market.spinAnim = {
      step: 0,
      totalSteps,
      winnerIndex: winner,
      timer: 0,
      stepDuration: 0.055,
      pendingLabel: label,
      pendingToast: toastText,
    };
    this.platform.audio.play('click');
  }

  private tickGachaSpin(dt: number): void {
    const anim = this.market.spinAnim;
    if (!anim) {
      if (this.market.pendingRefreshAt !== null && this.elapsedSec >= this.market.pendingRefreshAt) {
        this.syncDailyLottery();
        this.market.prizes = [...this.profile.lottery!.prizes];
        this.market.pendingRefreshAt = null;
        this.market.highlightIndex = null;
        this.market.lastPrizeIndex = null;
      }
      return;
    }
    if (this.modal !== 'market' || this.market.tab !== 'lottery') {
      this.finishGachaSpin(true);
      return;
    }
    anim.timer += dt;
    while (anim.timer >= anim.stepDuration && this.market.spinAnim) {
      anim.timer -= anim.stepDuration;
      anim.step += 1;
      this.market.highlightIndex = anim.step % 8;
      if (anim.step >= anim.totalSteps) {
        this.finishGachaSpin(false);
        return;
      }
      this.platform.audio.play('click');
      const slowStart = 16;
      if (anim.step <= slowStart) {
        anim.stepDuration = 0.055;
      } else {
        const frac = (anim.step - slowStart) / Math.max(1, anim.totalSteps - slowStart);
        anim.stepDuration = 0.072 + Math.pow(frac, 1.85) * 0.24;
      }
    }
  }

  private finishGachaSpin(silent: boolean): void {
    const anim = this.market.spinAnim;
    if (!anim) return;
    this.market.spinAnim = null;
    this.market.lastPrizeLabel = anim.pendingLabel;
    if (silent) {
      this.syncDailyLottery();
      this.market.prizes = [...this.profile.lottery!.prizes];
      this.market.pendingRefreshAt = null;
      this.market.highlightIndex = null;
      this.market.lastPrizeIndex = null;
      return;
    }
    this.market.highlightIndex = anim.winnerIndex;
    this.market.lastPrizeIndex = anim.winnerIndex;
    this.market.celebrateUntil = this.elapsedSec + 1.8;
    this.market.pendingRefreshAt = this.elapsedSec + 1.8;
    this.platform.audio.play('gacha_win');
    this.showToast(anim.pendingToast, 'good', 2.6);
  }

  private closeOverlayModal(): void {
    if (this.market.spinAnim) this.finishGachaSpin(true);
    else if (this.market.pendingRefreshAt !== null) {
      this.syncDailyLottery();
      this.market.prizes = [...this.profile.lottery!.prizes];
      this.market.pendingRefreshAt = null;
      this.market.highlightIndex = null;
      this.market.lastPrizeIndex = null;
    }
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
    this.clearWxFriendBoard();
    this.modal = null;
    this.checkMenuOnboarding();
  }

  private returnToMenu(): void {
    this.clearWxFriendBoard();
    this.screen = 'menu';
    this.modal = null;
    this.modalReturnTo = null;
    this.engine = null;
    this.speed3xTrialThisBattle = false;
    this.preDefeatProfile = null;
    const maxSpd = maxBattleSpeed(this.profile);
    if (this.speed > maxSpd) this.speed = maxSpd;
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
          if (this.tutorialStep !== 5 || this.engine.state.units.some(u => u.id === res.unitId && Boolean(HEROES[u.kind]))) {
            this.advanceBattleTutorial('merge');
          }
        } else {
          this.platform.audio.play('click');
          if (loc.zone === 'board') {
            const movedUnit = this.engine.state.units.find(u => u.id === res.unitId);
            if (this.tutorialStep === 6) {
              if (movedUnit?.kind === 'bee') this.advanceBattleTutorial('deploy-bee');
            } else {
              this.advanceBattleTutorial('deploy');
            }
          }
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
