# P2 Single-Player Overhaul Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development task by task, with focused review after each task.

**Goal:** Implement the supplied P2 solo defense specification, preserving the working P1 meta game and saved profiles.

**Architecture:** Keep the headless BattleEngine, pure configuration and Canvas/UI layers. Replace active dual-side simulation with a single player lane; legacy side-shaped data may remain inert for compatibility. Combat events carry animation state and the renderer mounts weapons independently of damage calculations.

**Tech stack:** Existing TypeScript, Vite, Canvas 2D, Vitest and Playwright Core.

**Spec:** `D:/rea_game/design/codex_p2_solo_overhaul_spec.md` (read-only, sole P2 authority), plus the user's detailed P2 request.

## Global Constraints

- ONLY create, modify, or delete files inside `D:/rea_game/games/capybara-defense/`.
- Never modify root baseline files or `D:/rea_game/design/`; read/copy source art only.
- Keep `127.0.0.1:4175`, `capybara_defense_v1:` and old profile/test-backup compatibility.
- Preserve 36 weapons, 20 props, 12 heroes/Bosses, 54 ranks, 16 avatars, music, encyclopedia, and P1 tutorial reward deduplication unless P2 explicitly changes a rule.
- Preserve the P1 Git checkpoint `319ea6c` / `v1.0-p1`; implementation branch is `p2-solo-overhaul` inside the independent game repository.
- No subagent dispatches children. Only root runs the browser/server lifecycle and commits; workers change only their assigned files and report focused test evidence.

## Review Focus

1. Failed redraw must preserve both the current pack and escalating summon count; reward receipt retries remain idempotent.
2. Bench tools must never enter combat, consume active prop cooldown on invalid use, merge into units, or swap onto a board cell.
3. All four endpoints must govern arrivals, summons, guardian art, rescue props and orange animations; no old half-board coordinate leaks.
4. Mid-attack source removal and missing optional art must preserve real damage and safe rendering; melee never emits generic projectile dots.
5. 390×844 input hit regions, tutorial overlays and the shovel pouch must agree with the new canvas geometry, including touch drag and language changes.

## Task 1: Solo simulation, economy and combat event contract

**Ownership:** `src/core/` except storage-independent untouched progression unless needed for solo reward semantics; `src/config/maps.ts`, `units.ts`, `waves.ts`, `enemies.ts`, new `combat.ts`; logic tests (`grid`, `battle`, `balance-v2`, `combat-details`, `merge`, `m2-props`, `m2-weapons`, `m2-meta`, `m3-maps`, `m3-bosses`, `m3-progression`, `p1-core`) and new `p2-core.test.ts`. No render, UI, CSS or i18n edits.

**Interfaces:**
- Export `GRID_COLS=6`, `GRID_ROWS=7`, exact STAGE and all four exact routes from spec §2.1–2.2. `getMap(...).paths.player` is canonical; legacy `paths.ai` may be an alias only, never a second simulated path.
- Export `getSummonCost(summons:number):number` from `config/units.ts`; SideState gets `summons:number=0`.
- `BattleState.craterHits:Record<string,number>` with keys `col,row`; repair count is 0 or 1 until tile restored, then key removed.
- `BattleEngine.move(id, boardTarget)` consumes a bench shovel to dig/repair; bench-to-bench swaps work, but no tool can land on board. `storeShovel(id:number):CommandResult` moves a valid bench shovel into the pouch up to `getShovelRules().maxStored`.
- New keys: `hint.repairProgress`, `hint.shovelStored`, `hint.shovelFull`, `hint.toolOnly`; successful tool use returns no dangling `unitId`. UI handles these keys.
- Unit optional `attackAngle:number`, `facing:1|-1`, `attackAnim:number`; Enemy optional `knockX/knockY`. VisualEvent adds `slash`, `hit`, `death`, `food`; effects use styles below, projectile `effect=unit.kind`.
- `config/combat.ts` exports `AttackStyle`, `COMBAT_STYLES:Record<string,AttackStyle>`, `DEFAULT_HELD_WEAPONS:Record<string,string>`, `WEAPON_RARITY_SCALES=[1.05,1.15,1.26,1.38,1.52]`. Exact default mapping/style table is spec §4.2; samurai style `cleave180` with heavy slash effect. Components may retain their existing small ranged attacks but have no mounted weapon; bee/shovel do not attack.

- [x] Write RED tests for exact maps/endpoints; no AI execution; victory/defeat and solo loot; cost 10/12/14/16 and atomic failure; shovel cap/dig/staged repair/store/filter/recycle; 55/30 regen; deterministic food; risk/reward relics; melee event contract/facing/decay/hit/death.
- [x] Implement §2–3 exactly. Initial22 food,1 shovel; prep18; wave2+ income3; no wave shovels; kill1/Boss8; bee18/1,11/1,7/2. Shovel weight10 and pack cap2; recycle shovel4 food. shared oranges+4/HP×1.15; party rate×1.38/enemy speed×1.12. Boss HP×1.15 rounded; husky700, skunk4600. All other specified wave values verbatim.
- [x] Keep `Side='player'|'ai'`, legacy result fields and `EngineOptions.ai` only if useful to avoid migration churn; no AI creation, waves, runtime or UI. Explicit AI commands must not mutate the solo battle. Loss winner may retain legacy `'ai'` sentinel without opponent simulation. Loss coins choose0 (spec permits original victory-only loot/reward policy).
- [x] Update affected existing logic tests to real P2 positions and rules, retaining unrelated assertions; replace removed AI behavior tests with explicit no-AI regression tests. Do not skip broad tests merely to get green.
- [x] Run owned logic tests, report RED/GREEN and remaining cross-layer failures. Root packages diff and requests task review.

## Task 2: Board and held-weapon/VFX renderer

**Ownership:** `src/render/`, render tests (`render`, `m2-render`, `m3-render`, `p1-render`, `p1-assets`) and new `p2-render.test.ts`; `public/sprites/README.md`. Root syncs art and owns sync script changes if needed.

**Interfaces:** Consume Task1 exact STAGE, combat map and optional attack fields/events. Create `HeldWeaponRenderer.ts` and `CombatEffects.ts` as focused rendering modules. Continue shared AssetRegistry and procedural fallback. All board drawing/hit testing derives dimensions from STAGE/GRID.

- [x] RED tests for 6×7 hit boundaries and bench/pouch coordinates, all 16 combat weapon mappings, default/equipped/rarity/awakening, styles and safe missing sprites, no AI guardian/wall/banner, dynamic guardian endpoint.
- [x] Implement spec §2.1 and §4 exactly: ~88px pet box and .92×(1+.06×levelDelta), regular .76/Boss1.04; guardian104×112. Map paints entire6×7, O/B dynamic overlays and 1/2 repair tag.
- [x] Render board-only mounted weapons for basic4 and all12 heroes (no bee/components/bench). Use real equipped sprite and rarity aura; animated body facing/lunge/squash, 2.1π spin orbit46/54 and145–185 ring,185° cleave,28px thrust,10px recoil + .12s muzzle, floating magic relics/ground rings.
- [x] Draw themed20–32px spinning projectiles with tapered trails, magic variants, directional hit jiggle/white flash/burst, death dust and food+1/+8 popups. Preserve existing real ult animations and status readability.
- [x] Bench shovel uses shovel image and translated DIG tag; valid G/B and pouch highlights, no misleading merge target. Position all lower tools/nests within1216 canvas. Update all sprite dictionary IDs to145 and tests accordingly.
- [x] Run owned tests and report evidence; root reviews diff before next task.

## Task 3: Solo UI, bilingual copy, tutorials and input

**Ownership:** `src/ui/` (except sound modules unless new visual events need cue routing), `src/i18n/`, `src/config/props.ts`, UI/i18n tests and new `p2-ui.test.ts`. Do not edit core/render.

**Interfaces:** Consume getSummonCost, move tool action, storeShovel and keys from Task1; use exact STAGE for overlays/input. Existing profile migration and test identity transactions remain.

- [x] RED tests for live summon cost/shortage/redraw, translations/no stale PvP text, new tool command routing, tutorial save/dedup, no opponent banner/AI loot column.
- [x] Canvas640×1216; clean stage640/1216, center width min(calc((100dvh - 58px) * .526316),calc(100vw - 18px),520px). Update all CSS absolute percentages, tutorial anchors and keyboard cells from dimensions.
- [x] Remove opponent markup and refresh logic; solo pause/result loot and wording. Retain ranks/leaderboard as honor showcase. Dev boss command spawns one player Boss; include shovel grant.
- [x] Route bench shovel select/drag onto G/B through move, onto pouch through storeShovel (including pointerup currently ignored at pouch); consumed selection clears; invalid/full operations show specific toast. Tool inspector avoids combat stat access. Apply shovel SFX/tutorial progress to partial repair.
- [x] Update shared_oranges to温泉加餐券/Hot Spring Feast Pass (+4 orange,+15%enemyHP), hyper_party(+38%attack/+12%enemySpeed), auto_shovel30s/cap6, guides55s/cap4 and escalating10→12→14. Add hint.redrawn exact translations. Add all new tool/repair/DIG keys.
- [x] Run owned tests and relevant sound tests; root reviews diff.

## Task 4: Full verification and delivery (root)

- [x] Capture before/after read-only protection and copy/hash all145sourcePNGs + exact manifest, map dimensions768×896.
- [x] Run npm test, npm run typecheck, npm run build. Inspect all failures and fix owner domain; old P1 tests changing due P2 explicitly documented.
- [x] Update existing browser smoke fixtures for solo dimensions/food and add scripts/p2-browser-qa.mjs with actual click and drag shovel flows, partial repair, pouch full, cost12/14, no raw translation keys, all four maps.
- [x] Inspect desktop1440×900 and mobile390×844 screenshots, real attacks with held spin blade and ranged projectiles, bench shovel and live cost; save under verification/p2-*.png with zero console/pageerror evidence. Verify production build and profile/test-backup lifecycle.
- [x] Final independent review of full diff, address significant findings, report modules/tests/screenshots/start URL and isolation. No external publication or root Git writes.
