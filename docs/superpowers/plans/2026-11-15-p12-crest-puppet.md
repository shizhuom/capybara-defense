# P12 Crest Settlement and Continuous Puppet Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Independent UI and pure animation domains use dispatching-parallel-agents.

**Goal:** Deliver winged-shield results, a cocoa storybook pause, and continuous single-sprite animation without changing gameplay or audio.
**Architecture:** SettlementView produces semantic, bilingual markup; GameApp owns drawer interaction. EnemyMotion and SpritePuppetAnimator remain rendering-only; StickerRenderer owns the paused scene clock and lifecycle, CombatEffects owns death flight.
**Tech Stack:** TypeScript, native Canvas 2D, Vite, Vitest, Playwright.
**Spec:** D:/rea_game/design/codex_v2_p12_victory_shield_pause_and_fluid_animation_spec.md

## Global Constraints
- All writes remain inside D:/rea_game/games/capybara-defense; design and Three Kingdoms baseline are read-only.
- SoundManager.ts, MusicTracks.ts, AudioGestures.ts remain byte-identical.
- Port 127.0.0.1:4175; profile prefix capybara_defense_v1: unchanged.
- 217 PNG assets, retain all walk2 files but never sample them in enemy rendering.
- Pause keeps exactly one bare section tag. Result statistics remain in DOM, hidden by default.

## Review Focus
- Pause/resume must not accumulate wall-clock time into gait, turns, hit recovery, steam or particles.
- Full result, open statistics and pause remain usable in 390x844 and 844x390, including long English ranks.
- Missing PNGs use safe vector rendering; slice source rectangles never exceed image bounds.
- Fresh battle/unit IDs cannot inherit old pose state; merging resets pop without resetting combat statistics.
- Statistics toggle preserves rewards, focus and single settlement award; Escape closes drawer before leaving results.

### Task 1: Preserve baseline, assets and UI shells
Files: scripts/p12-isolation-check.mjs, stickers.ts, i18n/p12.ts, SettlementView.ts, p12.css, GameApp.ts, main.ts, tests/p12-settlement.test.ts.
Interfaces: ResultViewInput gains optional statsOpen:boolean; resultMarkup retains reward hooks; export P12_SCENE_IDS.
- [x] Save accepted P11 checkpoint ead6dcb on p11-storybook-hub; work on p12-crest-puppet-animation.
- [x] Capture protected hashes, sync 217 assets, verify eight dimensions and SVG fallbacks.
- [x] RED: tests for 0/1/2/3 lit stars, hidden statistics, preserved MVP/loot, one pause section, bilingual controls.
- [x] Implement transparent four-anchor crest and two-card pause with responsive p12.css; GameApp drawer focus lifecycle.
- [x] GREEN: targeted settlement/assets tests and typecheck.

### Task 2: Pure single-sprite rig and species motion
Files: SpritePuppetAnimator.ts, EnemyMotion.ts, tests/p12-puppet.test.ts, tests/p3-render.test.ts.
Interfaces: RigPose {phase,spineLag,leanX,waveAmpX,breatheAmp,strideX,liftY,splitLegs}; drawPuppetSprite(ctx,image,size,pose); EnemyMotion.sample(enemy,seconds,paused,path) returns prior pose fields plus rig, spawnScale, jello, visualFlip, bankTilt, archetype, wingPhase, motorPhase, landing and roar.
- [x] RED: continuous sliced geometry, bounds/overlap, opposite feet, seven archetypes, progress-driven gait, smooth flip, stun/pause and spawn/re-hit timing.
- [x] Implement six torso and three split-leg bands plus seven species curves; preserve direction semantics, remove useWalk2.
- [x] GREEN: new pure motion tests and intentionally updated obsolete two-frame tests.

### Task 3: Renderer lifecycle and combat integration
Files: StickerRenderer.ts, UnitMotion.ts, HeldWeaponRenderer.ts, CombatEffects.ts, tests/p12-render.test.ts.
Interfaces: UnitMotion.sample(unit,seconds,paused) returns facing, rig, spawnScale and body pose; death event already contains enemyKind/boss.
- [x] RED: drawEnemy samples only base PNG; death draws source sprite before smoke; all draw calls stable while paused; ally deployment/merge and attack continuity.
- [x] Integrate monotonic frozen render clock, rigs, species wings/rollers/landing/roar, smooth allied facing and three-phase attack. Preserve held weapons, merge hints and guardian bath anchors.
- [x] GREEN: render and combat suites, all tests, typecheck/build.

### Task 4: Browser QA and delivery
Files: scripts/p12-browser-qa.mjs, verification/p12-*, docs/P12-verification.md.
- [x] Capture desktop/phone landscape/portrait results, stats, pause and animation sequences; exercise actions, no runtime/image errors or clipping.
- [x] Verify frozen canvas on pause, continuous motion at 60 Hz and frame-time measurements with crowded battle.
- [x] Fresh independent review; fix important findings with regression tests.
- [x] Run full npm test, build, protected hash check, diff whitespace check; record exact results and limitations.

## Decisions
- User supplied a complete approved design: continue implementation without redundant design approval.
- Dedicated independent agents own UI shell and pure animation modules; parent owns assets, integration, QA and final review. No overlapping writes.
- P11 checkpoint is a local nested-repository commit; no parent .git or external publishing is touched.

## Completion ledger
- Task 1: P11 checkpoint ead6dcb; 217 assets; settlement, drawer, fallback and legacy compatibility checks pass.
- Task 2: 38 pure motion/slice tests plus updated P3 tests pass. flipX remains logical; visualFlip is the rendering field. Hopper phase edges are interpolated to avoid discontinuities.
- Task 3: Renderer/ally/death integration is green. Initial supplied scene time is retained for M2 compatibility; subsequent paused deltas do not advance animation. No simulation/audio changes.
- Task 4: 1,151 tests across 61 files, typecheck/build, 54 browser captures, production relative paths and 2,429-file isolation check pass. Independent review found no Critical/Important product bugs. Its planned long-label/full-content verification gap is closed by p12-edge-qa.mjs (15 passing checks).
- Final review limitations: final CSS recaptured and inspected by parent; physical-mobile sustained FPS not measured, explicitly documented; whole test suite freshly run by parent rather than duplicated by reviewer.