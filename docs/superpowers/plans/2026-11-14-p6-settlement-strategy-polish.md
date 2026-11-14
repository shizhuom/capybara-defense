# P6 Settlement and Strategy Polish Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with test-driven-development per task and one fresh whole-branch review. The user's exact implementation spec and workspace authorize execution without another design approval round.

**Goal:** Finish illustrated pause/results, on-board hero teaching and safe overlays, polish six ledger pages, and add honest wave previews, early waves, passive merge hints and one bench lock.

**Architecture:** Keep deterministic battle behavior in core/config. Add a private combat-record helper for MVP lineage; reuse merge queries with a separate passive-hint classifier so existing feed-highlight behavior stays compatible. Extract settlement markup from GameApp into a focused renderer. Reuse the P5 shell and layer p6.css last.

**Tech Stack:** Existing TypeScript/Vite/Canvas/Vitest/Playwright, no new dependencies.

**Spec:** `D:/rea_game/design/codex_p6_polish_settlement_hud_spec.md` (fully read).

## Global Constraints

- All writes remain inside `D:/rea_game/games/capybara-defense/`; design and parent project are read-only. Work in the existing standalone repository on `p6-settlement-strategy-polish`, retaining `v1.0-p5`.
- Port127.0.0.1:4175, storage prefix capybara_defense_v1:, existing economy, four maps, ranks, normal/test profile isolation remain.
- Sync193 exact source PNGs and manifest to public/assets/sprites; eight new icons have SVG fallbacks.
- Pause contains exactly one attribute-free `<section>`, reserved for player loot; retain every existing action and hidden select[data-weapon].
- Boss schedule uses `new Random(((seed ^ 0x6d2b79f5) >>> 0) || 1)` only; preview reads never consume the main PRNG.
- No new Unit fields for MVP. Bench lock is optional on SideState and not persisted across battles.

## Review Focus

1. Damage-over-time and weapon callbacks after a merge must credit the surviving lineage once; overkill, shields and non-unit prop damage cannot inflate MVP.
2. Preview queries cannot mutate the schedule; rank40+ previews must match real primary and delayed secondary Bosses, even after unrelated summons.
3. Lock leaves no stale slot after deploy/merge/swap/recycle/shovel-store; rejected actions must preserve it and insufficient food must preserve the full pack.
4. Tutorial hold forbids horn/lock; replay remains guaranteed. Bubble geometry must use actual live-card/Boss rectangles, language and mobile dimensions.
5. Fixed result buttons, short landscape settings and growth tables remain reachable with long English text, empty loot/MVP and many unlocks.

## Task 1: Deterministic wave tools and bench lock

Files: core/BattleEngine.ts, core/types.ts, core/MergeTargets.ts; tests/p6-strategy.test.ts.

Interfaces: `WavePreview {wave:number;count:number;bosses:readonly string[];minion:string}`; `getUpcomingWavePreview():WavePreview|null`; `canCallEarlyWave():{allowed:boolean;bonusFood:number}`; `callEarlyWave():CommandResult`; `toggleBenchLock(slot:number):CommandResult`. Optional `SideState.lockedBenchSlot` starts null. `getBenchMergeHints(state)` returns slot/unitId plus hero|upgrade, preserving existing getMergeTargets feed contracts.

- [x] Write failing behavior tests: schedule matches real waves/rank40+, query isolation/main RNG; preparation horn reward8 and immediate first spawn, clear-wave bonus3–10+normal3 income, all rejection gates; one lock, four rerolls, cost/seed/caps and every removal path; distinguish new hero from feed/upgrade hints.
- [x] Precompute readonly schedule at construction. Reuse it in beginWave and return defensive preview copies; choose highest-threat minion present in the next wave. Horn uses exact spec formulas and emits food feedback.
- [x] Bind the lock to the original unit identity internally; validate slot still contains that identity. Clear on actual successful movement/merge/removal, including props. Summon keeps locked unit and draws only vacant slots, max2 shovels for the final pack.
- [x] Run focused/full tests and typecheck; commit.

## Task 2: MVP lineage

Files: core/CombatRecords.ts (new), BattleEngine.ts, types.ts; tests/p6-mvp.test.ts.

Interfaces: `BattleMVP {kind:string;level:number;damage:number;kills:number}` optional on BattleResult. CombatRecords records effective health damage and kill ownership, merges source/target records into result identity, and resolves aliases for delayed DoT ownership. No display fields added to Unit.

- [ ] Write failing real-engine tests for clamped damage, armor/DoT/weapon kills, source+target inheritance through basic upgrade/hero creation/feed, post-merge DoT, dead/recycled contributors and empty battles.
- [ ] Record before weapon hook recursion; merge before replacing units; resolve the highest damage then kills then stable id. Refresh live metadata at settlement; no MVP if no unit contributed damage.
- [ ] Run focused/full tests and typecheck; commit.

## Task 3: Assets, settlement ledgers and subpage polish

Files: public/assets/sprites, stickers.ts, GameApp.ts, SettlementView.ts (new), p6.css (new), i18n/p6.ts (new), i18n.ts, MetaScreens.ts, ProfileScreens.ts, Compendium.ts; tests/p6-assets.test.ts and p6-settlement.test.ts.

Interfaces: `lootMarkup(loot)` shared illustrated counts; `pauseMarkup(state)` and `resultMarkup({state,profile,savedResult,resultStars,previousRank,newWeapons,newAvatars})`. Preserve existing dialog action ownership and data attributes.

- [ ] Write failing193asset/fallback and bilingual pause/result/MVP/promotion/unlock/empty tests; preserve one bare section and hidden equipment select assertions.
- [ ] Sync assets, add8 SVG geometries and async refresh IDs. Extract pause/result into themed fixed header/body/footer shells, with weapon/portrait unlock art and current-battle facts.
- [ ] Visually hide redundant equip select, retain keyboard access, replace redundant unequip text button with one status badge. Move shop refresh into awning; remove duplicate settings language, consume range-fill gradient; use star stickers.
- [ ] Tighten English tabs and unbroken growth headings; desktop and short-landscape settings fit all controls. Run suite/build.

## Task 4: Tutorial on-board merge and overlay avoidance

Files: TutorialView.ts, GameApp.ts, p6.css, p6 i18n; tests/p6-tutorial.test.ts and UI integration tests.

Interfaces: `tutorialMarkup(step,state,selectedId?,guide?,avoidRects?:TutorialRect[])`; pure candidate placement helper supporting minimum-overlap fallback. GameApp measures live card/Boss stage rectangles and rerenders on geometry change.

- [ ] Write failing target tests: bench panda→open pad then bench hat→board panda, deploy retainsstep4, direct bench merge stillstep5. Test avoidance including left/right card and Boss, plus completion hero-on-bench reminder.
- [ ] Implement candidate pool and measured reflow without target collisions; compact short landscape bubble and retain portrait letterbox behavior. Move no-side-space toast to board upper safe band; pointer-events none.
- [ ] Run all existing P5 tutorial/input tests and new focused tests; typecheck.

## Task 5: HUD, passive flash hints and lock input

Files: GameApp.ts, StickerRenderer.ts, LiveUnitCard.ts, BattleHUD.ts or WaveToolsView.ts, p6.css; tests/p6-render.test.ts and p6-ui.test.ts.

Interfaces: HitTarget adds bench-lock/slot. HitTest accepts optional interaction context enabling locks only on occupied nests, outside tutorial and outside drag release. Live card input gets lock eligibility. Horn and preview actions are delegated through existing action dispatcher.

- [ ] Write failing HUD/reward/lock/presentation tests; ensure drag drop on lock corner remains a bench move, selected prop cannot spend on lock toggle, tutorial and invalid state reject locks.
- [ ] Add adjacent compact preview (24/26px one/two portraits, bilingual title/tips) and horn reward; mobile must preserve resource/control separation. Add lock corner art/frame and live-card lock action; refresh count becomes4 when locked.
- [ ] Render passive hero gold frame/28pxsparkle and upgrade22pxsparkle outside drag/prop targeting. Show non-blocking summon hero warning only for unlocked new-hero ingredients.
- [ ] Run suite/build and existing P3/P4/P5 interaction checks with only intentionally superseded screenshot/asset expectations updated.

## Task 6: Verification and delivery

- [ ] Capture P6 desktop1280×720/mobile844×390 pause/win/loss, armory/English guide/settings/shop, tutorial4 and wave/lock/merge HUD. Verify no card collision, all6tabs/whole words, complete settings/footer, scroll reachability, console/pageerror0; inspect screenshots.
- [ ] Run full npm test/typecheck/build, sync193, production relative paths and profile backup checks. Compare protected baseline hashes and source asset bytes.
- [ ] One independent whole-branch review; fix material findings with failing regression first. Archive docs/P6-verification.md, commit/tag local v1.0-p6, leave4175 production service healthy and Git clean.
