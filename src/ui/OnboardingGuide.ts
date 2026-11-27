import type { Profile } from '../core/types';
import {
  isFeatureUnlocked,
  hasOnboarded,
  type FeatureId,
  type OnboardingKey,
} from '../core/FeatureUnlocks';
import { profileMedallionTotal } from '../core/MedallionProgression';
import { t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';
import { sceneSticker } from './stickers';

const tr = (key: string, vars?: Record<string, string | number>) => esc(t(key, vars));

const FEATURE_MASCOT: Record<FeatureId, Parameters<typeof sceneSticker>[0]> = {
  armory: 'ui_armory_peek_capy',
  speed2x: 'ui_tutorial_capy',
  market: 'ui_market_peek_raccoon',
  endless: 'ui_endless_emblem',
  village: 'ui_village_peek_capy',
  kitchen: 'ui_kitchen_peek_capy',
  medallions: 'ui_medallion_peek_capy',
  speed3x: 'ui_tutorial_capy',
};

/** Warm carved-wood courtyard welcome card when a new hub system unlocks. */
export function menuWelcomeMarkup(feature: FeatureId): string {
  const mascot = FEATURE_MASCOT[feature];
  return `<aside class="onboarding-welcome-backdrop" role="region" aria-label="${tr(`p19.onboard.${feature}.title`)}">
    <div class="onboarding-welcome-card">
      <div class="onboarding-welcome-art" aria-hidden="true">${sceneSticker(mascot, '', 92)}</div>
      <div class="onboarding-welcome-copy">
        <span class="onboarding-badge">${tr('p19.guideTag')}</span>
        <h3>${tr(`p19.onboard.${feature}.title`)}</h3>
        <p>${tr(`p19.onboard.${feature}.body`)}</p>
        <div class="onboarding-welcome-actions">
          <button type="button" class="onboarding-primary-btn" data-action="onboard-go:${feature}" autofocus>${tr('p19.guideGo')}</button>
          <button type="button" class="onboarding-skip-btn" data-action="onboard-skip:${feature}">${tr('p19.guideSkip')}</button>
        </div>
      </div>
    </div>
  </aside>`;
}

export interface DialogGuideContext {
  dialogKind: string | null;
  detailWeaponId: string | null;
  marketTab: string;
  marketSpun: boolean;
  villageTab: string;
  villageInteracted: boolean;
  armoryTab?: string;
  kitchenTab?: string;
  medallionTab?: string;
}

export interface DialogGuideStep {
  feature: FeatureId;
  textKey: string;
  done: boolean;
  pulseSelector?: string;
}

/** Computes the active step inside an opened feature dialog so the guide never gets stuck. */
export function computeDialogGuideStep(
  feature: FeatureId,
  profile: Profile,
  ctx: DialogGuideContext,
): DialogGuideStep | null {
  if (feature === 'armory' && ctx.dialogKind === 'armory') {
    const anyEquipped = Object.values(profile.equippedWeapons).some(Boolean);
    if (anyEquipped) return { feature, textKey: 'p19.onboard.armory.done', done: true };
    if (ctx.detailWeaponId === 'm01_swatter') {
      return {
        feature,
        textKey: 'p19.onboard.armory.step2',
        done: false,
        pulseSelector: '[data-action="meta-equip:m01_swatter:kungfu_po"]',
      };
    }
    if (ctx.armoryTab && ctx.armoryTab !== 'all' && ctx.armoryTab !== 'melee') {
      return {
        feature,
        textKey: 'p19.onboard.armory.step1',
        done: false,
        pulseSelector: '[data-action="meta-tab:melee"]',
      };
    }
    return {
      feature,
      textKey: 'p19.onboard.armory.step1',
      done: false,
      pulseSelector: '[data-action="meta-weapon:m01_swatter"]',
    };
  }

  if (feature === 'market' && ctx.dialogKind === 'market') {
    const hasEquippedActive = profile.equippedActiveProps.length > 0;
    if (hasEquippedActive && ctx.marketSpun) {
      return { feature, textKey: 'p19.onboard.market.done', done: true };
    }
    if (!ctx.marketSpun && (profile.freeLotteryTickets ?? 0) > 0) {
      if (ctx.marketTab !== 'lottery') {
        return {
          feature,
          textKey: 'p19.onboard.market.step1',
          done: false,
          pulseSelector: '[data-action="meta-tab:lottery"]',
        };
      }
      return {
        feature,
        textKey: 'p19.onboard.market.step2',
        done: false,
        pulseSelector: '.lottery-center',
      };
    }
    if (!hasEquippedActive) {
      if (ctx.marketTab !== 'backpack') {
        return {
          feature,
          textKey: 'p19.onboard.market.step3',
          done: false,
          pulseSelector: '[data-action="meta-tab:backpack"]',
        };
      }
      return {
        feature,
        textKey: 'p19.onboard.market.step4',
        done: false,
        pulseSelector: '[data-action="meta-prop:glue_trap"]',
      };
    }
    return { feature, textKey: 'p19.onboard.market.done', done: true };
  }

  if (feature === 'village' && ctx.dialogKind === 'village') {
    const hasPool = (profile.village?.facilities?.fac_bamboo_pool ?? 0) >= 1;
    if (hasPool && ctx.villageInteracted) {
      return { feature, textKey: 'p19.onboard.village.done', done: true };
    }
    if (!hasPool) {
      if (ctx.villageTab !== 'build') {
        return {
          feature,
          textKey: 'p19.onboard.village.step1',
          done: false,
          pulseSelector: '[data-action="village-tab:build"]',
        };
      }
      return {
        feature,
        textKey: 'p19.onboard.village.step2',
        done: false,
        pulseSelector: '[data-action="village-build:fac_bamboo_pool"]',
      };
    }
    if (ctx.villageTab !== 'courtyard') {
      return {
        feature,
        textKey: 'p19.onboard.village.step3',
        done: false,
        pulseSelector: '[data-action="village-tab:courtyard"]',
      };
    }
    return {
      feature,
      textKey: 'p19.onboard.village.step3b',
      done: false,
      pulseSelector: '.village-pet, .village-harvest-btn:not(:disabled)',
    };
  }

  if (feature === 'kitchen' && ctx.dialogKind === 'kitchen') {
    if ((profile.unlockedBroths?.length ?? 0) > 0) {
      return { feature, textKey: 'p19.onboard.kitchen.done', done: true };
    }
    if (ctx.kitchenTab && ctx.kitchenTab !== 'broths') {
      return {
        feature,
        textKey: 'p19.onboard.kitchen.step1',
        done: false,
        pulseSelector: '[data-action="kitchen-tab:broths"]',
      };
    }
    return {
      feature,
      textKey: 'p19.onboard.kitchen.step1',
      done: false,
      pulseSelector: '[data-action="kitchen-brew:dish_yuzu_bath"]',
    };
  }

  if (feature === 'medallions' && ctx.dialogKind === 'medallions') {
    if (profileMedallionTotal(profile) > 0) {
      return { feature, textKey: 'p19.onboard.medallions.done', done: true };
    }
    if (ctx.medallionTab && ctx.medallionTab !== 'medallions') {
      return {
        feature,
        textKey: 'p19.onboard.medallions.step1',
        done: false,
        pulseSelector: '[data-action="medallion-tab:medallions"]',
      };
    }
    return {
      feature,
      textKey: 'p19.onboard.medallions.step1',
      done: false,
      pulseSelector: '[data-action="medallion-up:med_breakthrough_atk"]',
    };
  }

  return null;
}

/** Compact warm-wood coaching strip rendered inside an open ledger dialog. */
export function dialogGuideBannerMarkup(step: DialogGuideStep): string {
  const mascot = FEATURE_MASCOT[step.feature];
  const actionBtn = step.done
    ? `<button type="button" class="onboarding-primary-btn" data-action="onboard-done:${step.feature}">${tr('p19.guideGotIt')}</button>`
    : `<button type="button" class="onboarding-skip-btn" data-action="onboard-skip:${step.feature}">${tr('p19.guideSkip')}</button>`;
  return `<section class="onboarding-dialog-banner${step.done ? ' is-done' : ''}" role="status" aria-live="polite">
    <span class="onboarding-banner-art" aria-hidden="true">${sceneSticker(mascot, '', 44)}</span>
    <p class="onboarding-banner-text">${tr(step.textKey)}</p>
    <span class="onboarding-banner-actions">${actionBtn}</span>
  </section>`;
}

export type BattleLessonKey = 'speed2x' | 'prop_battle' | 'endless_battle' | 'speed3x';

/** Returns the next one-time in-battle coaching card due in the current combat frame. */
export function nextBattleLesson(
  profile: Profile,
  options: { endless: boolean; hasActiveProp: boolean },
): BattleLessonKey | null {
  if (options.endless && !hasOnboarded(profile, 'endless_battle')) return 'endless_battle';
  if (isFeatureUnlocked(profile, 'speed3x') && !hasOnboarded(profile, 'speed3x')) return 'speed3x';
  if (isFeatureUnlocked(profile, 'market') && options.hasActiveProp && !hasOnboarded(profile, 'prop_battle')) return 'prop_battle';
  if (isFeatureUnlocked(profile, 'speed2x') && !hasOnboarded(profile, 'speed2x')) return 'speed2x';
  return null;
}

/** In-battle one-time lesson card (speed2x, active props, Wave-11 endless breakthrough, speed3x). */
export function battleLessonMarkup(key: BattleLessonKey): string {
  const mascot = key === 'endless_battle' ? 'ui_endless_emblem' : key === 'prop_battle' ? 'ui_market_peek_raccoon' : 'ui_tutorial_capy';
  const anchorClass = key === 'speed2x' || key === 'speed3x' ? 'pos-top-right' : key === 'prop_battle' ? 'pos-left-prop' : 'pos-center';
  return `<div class="battle-lesson-card ${anchorClass}" data-lesson="${key}" role="dialog" aria-label="${tr(`p19.onboard.${key}.title`)}">
    <div class="battle-lesson-head">
      <span class="battle-lesson-art" aria-hidden="true">${sceneSticker(mascot, '', 52)}</span>
      <div>
        <span class="onboarding-badge">${tr('p19.guideTag')}</span>
        <h3>${tr(`p19.onboard.${key}.title`)}</h3>
      </div>
    </div>
    <p>${tr(`p19.onboard.${key}.body`)}</p>
    <div class="battle-lesson-actions">
      <button type="button" class="onboarding-primary-btn" data-action="battle-lesson-ack:${key}">${tr('p19.guideGotIt')}</button>
    </div>
  </div>`;
}

export function isOnboardingKey(value: string): value is OnboardingKey {
  return ['armory', 'speed2x', 'market', 'endless', 'village', 'kitchen', 'medallions', 'speed3x', 'prop_battle', 'endless_battle'].includes(value);
}
