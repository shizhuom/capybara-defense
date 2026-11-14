# P5 Ledger, Tutorial and Difficulty Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, test-first per task, with one fresh whole-branch review after implementation. Execute the user-provided authoritative design directly; do not introduce another approval gate.

**Goal:** Upgrade the six subpages, five-step guaranteed tutorial, safe click selection and all-rank difficulty while retaining P4 art, existing progression and transactional saves.

**Architecture:** Keep rank/wave data and headless simulation in config/core. Reuse existing action routes and add a small shared ledger markup module, late-loaded P5 styles and localized copy. Move the canonical local sprite bundle to the explicitly requested `public/assets/sprites/` path, retaining P4 in Git.

**Tech Stack:** Existing TypeScript, Vite, Canvas 2D, Vitest and Playwright; no new dependencies.

**Spec:** `D:/rea_game/design/codex_p5_ui_tutorial_difficulty_spec.md`, fully read before code changes.

## Global Constraints

- All writes stay inside `D:/rea_game/games/capybara-defense/`; design and parent baseline remain read-only.
- Preserve port `127.0.0.1:4175`, storage prefix `capybara_defense_v1:`, old save fields, normal/test-profile transactions and P4 rollback tag.
- 185 exact source PNGs and source manifest become the canonical `public/assets/sprites/` bundle.
- Keep 22 initial food, escalating five-draw cost 10/12/14…, one starting shovel, P2 regen, four 9×5 maps, all 36 weapons / 20 props / 54 ranks.
- Existing semantic controls (`data-weapon`, `data-rarity`, `data-setting`, leaderboard row/player attributes) remain available.

## Review Focus

1. Tutorial replay during paused battle/modal ownership and storage failure must not award twice or retain the old battle.
2. Tutorial redraw, wrong merge order, already merged hero, lost pair and viewport/language changes must not trap the player or cover targets.
3. Tap vs drag vs keyboard must distinguish focus switching from swaps; invalid prop taps must not spend charges or emit errors.
4. Rank 53 wave 1 must finish spawning its extra minions before advancing, and wave 10 must await both extra minions and delayed secondary Boss.
5. Every ledger body must scroll to its last content on 1280×720 and 844×390; fixed tabs/header, long English text and preserved scroll during equips must remain usable.

## Task 1: Headless difficulty and guided opening

Files: `src/config/ranks.ts`, `waves.ts`, `src/core/BattleEngine.ts`, focused core tests and intentional rank/economy expectations in old tests.

Interfaces: export `RankDifficulty` / `getRankDifficulty(rankIndex, {tutorialGuided?})`, one-based `waveEnemyCount(waveNumber, rankIndex)`, `minionForWave(waveNumber, spawnIndex, rankIndex)`, Boss count/selection helpers. Engine exposes `setTutorialHold(active)` and `currentWaveTargetCount()`; `EngineOptions.tutorialGuided?` defaults false.

- [ ] Write tests for spec HP anchors and monotonic HP/speed/count/rewards; tutorial-only 0.85 HP at rank 0; first draw exact five Lv.1 units even with promotion props; ordinary seeded draws unchanged; hold/release minimum 8s; staged distinct Bosses and final clear gate. Observe failures.
- [ ] Implement HP and speed interpolation using every table interval endpoint. Use exact `floor(rank/4)` and `max(.62,1-rank*.007)` formulas. Coins round linear 60→220. Armor starts +.04 at rank20 and smoothly reaches +.10 at rank53; Boss cooldown anchors rank0/9=1,10=.94,20=.90,30=.84,39=.80,53=.75. Document these choices because no per-rank formula was supplied for armor/cooldown.
- [ ] Preserve default rank0 minion sequence; add roaches at wave2/rank5 and latter half of wave1/rank15, denser crabs from rank5/10, bees wave5/rank15, charmed rats wave4/rank30. Boss pressure follows exactly the specified rank/wave thresholds, secondary delay 5s and distinct kind.
- [ ] Run focused and full Vitest; expected all pass after updating only superseded old numeric expectations. Commit.

## Task 2: Five-step guide and safe interaction

Files: `Tutorial.ts`, `TutorialView.ts`, `GameApp.ts`, focused guide/input tests, `src/i18n/p5.ts`.

Interfaces: `TutorialStep=1|2|3|4|5|'done'`; new action `open-compendium`. Tutorial target geometry is derived from current unit positions and the real Guide button rect; markup is still visual-only. `activate(hit,{dragged?,fromKeyboard?})` preserves explicit moves while taps select/merge/cancel.

- [ ] Write failing tests for all five transitions, +20 only once, tutorial replay new battle, hold release, bad/missing pair acknowledgement, same-unit/blank/non-placeable tap cancellation, board→empty cancellation, bench deployment, target focus switching, true merge/feed, drag swaps and keyboard moves.
- [ ] Implement guided GameApp start/replay and persistence-safe completion; Step5 Guide opens the book and completes reward. Keep pointer-origin guard for dynamically appearing ack/skip controls.
- [ ] Implement visual source/target spotlights, dashed arrows, paw pointer and five progress dots, with measured safe bubble placement. Supply actionable fallback ack when pairs are unavailable.
- [ ] Implement silent invalid taps and perimeter cancellation without touching modal/controls or drag routing. Verify full suite. Commit.

## Task 3: Assets and shared ledger shell

Files: `public/assets/sprites/*`, `AssetRegistry.ts`, `scripts/sync-assets.mjs`, `stickers.ts`, `CourtyardView.ts`, `GameApp.ts`, `LedgerView.ts`, `p5.css`, i18n and asset/shell tests.

Interfaces: default registry BASE_URL + `assets/sprites/`; all 12 new scene sticker IDs have vector geometry. Ledger helper produces fixed header/tabs and `.ledger-body`; GameApp keeps modal ownership and restores body scroll for same-page updates.

- [ ] Add failing asset/fallback and header/scroll-wrapper tests. Move the existing local sprite directory only after verifying both resolved paths are within the game; sync all185 PNGs and exact source manifest. Update active test paths/counts and sync script.
- [ ] Add 12 vector fallbacks, refresh IDs, coin/star/ticket stickers on menu and result. Import `p5.css` last.
- [ ] Implement shared ledger header/wallet/language controls and grouped page tabs, keeping pause/result separate. Verify missing-assets mode and relative subdirectory paths. Commit after full suite passes.

## Task 4: Six illustrated subpages

Files: `Compendium.ts`, `MetaScreens.ts`, `ProfileScreens.ts`, `LedgerView.ts`, `p5.css`, i18n and UI tests.

- [ ] Write failing tests for rounded stat tables (38,61,97,156,249 example), matrix corner, collection badges, group routing, 4 matching hero equip chips with toggle-off, kept select/checkbox semantics, market persistent slots, podium order and threat panels, settings replay/inputs.
- [ ] Build collection cards, 12 hero stands, 3-column armory and colored recycling pills. Keep equip persistence atomic and prep loadout sync behavior.
- [ ] Build market/gacha left stall and persistent right backpack; build podium, keeper passport/stat grid/avatar wall, warm audio sliders/toggle cards and language/replay controls. Localize all new copy.
- [ ] Verify suite/typecheck/build. Commit.

## Task 5: Visual acceptance and delivery

- [ ] Add/run P5 browser flows on 1280×720 and mobile landscape: all seven subpage states and five tutorial steps; also check both languages, inner scroll reachability, profile/settings group links, chip equip/unequip, tap/drag safety, replay during battle and menu.
- [ ] Save and inspect all screenshots in `verification/`. Fix actual overlap or clipping before delivery. Retain relevant P3/P4 regression flows with only intentionally superseded expectations updated.
- [ ] Run full tests, typecheck/build, production-relative-path/profile checks and protected-file hash/185 asset parity checks.
- [ ] One fresh whole-branch review, one test-driven material-fix pass, archive evidence/rulings, local commit/tag and running production service at4175.
