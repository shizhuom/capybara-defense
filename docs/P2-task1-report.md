# P2 Task 1 Report

Implemented the solo simulation, economy, tool interactions and combat event contract from the complete P2 specification. All worker changes are inside this independent game directory. No render, UI, CSS, i18n, storage, design directory or root baseline writes; no commit, server lifecycle or child agents.

## Verification and RED/GREEN evidence

- Initial command: npm test -- tests/p2-core.test.ts. Observed29/29 RED assertions against the original P1 runtime: old geometry/routes, AI execution, fixed summon prices, missing tool operations, old regeneration/income, missing slash/hit/death/food events, old settlement. Exit1, actual behavior mismatches (not an import error).
- Implemented those contracts: same command29/29 GREEN, exit0.
- Added explicit cross-side tool-merge regression. Observed1 failed /33 passed: bench tool handling incorrectly preceded side validation. Moved side validation first; final test is GREEN.
- Added legacy AI-enemy-helper regression. Observed1 failed /34 passed: detached AI enemy damage still created food/events and consumed IDs. Blocked AI damage/DOT, returned detached id0 without advancing the command sequence, and restricted washing ticks to player units. Final test is GREEN.
- Final owned logic suite: **13 files,424 tests passed**, exit0, including35 P2-specific tests. Existing36 weapon,12 hero,12 Boss, all merge/prop/progression/storage/tutorial checks pass after position/rule adaptation. No skips were introduced.
- Final typecheck: npm run typecheck, exit0.
- Final complete project command: npm test -- --reporter=json --outputFile=docs/p2-task1-full-tests.json. **536 passed,69 failed**, exit1. The69 remaining failures are all outside Task1 ownership and listed below. Raw evidence: [p2-task1-full-tests.json](p2-task1-full-tests.json). Renderer/UI work remains necessary; no claim of a passing full project build or browser QA.

Owned-suite command (run from game directory):

```powershell
npm test -- tests/grid.test.ts tests/battle.test.ts tests/balance-v2.test.ts tests/combat-details.test.ts tests/merge.test.ts tests/m2-props.test.ts tests/m2-weapons.test.ts tests/m2-meta.test.ts tests/m3-maps.test.ts tests/m3-bosses.test.ts tests/m3-progression.test.ts tests/p1-core.test.ts tests/p2-core.test.ts
```

## Changed files

Production:
- src/config/maps.ts ? exact6x7 matrices,18/21/23/22-point routes, GRID_COLS/GRID_ROWS and exact1216px stage.
- src/config/units.ts ? escalating summon helper, tool definition and draw weight, new economy/bee/shovel constants.
- src/config/waves.ts ? all ten wave values and18s first-wave preparation.
- src/config/enemies.ts ? ordinary HP28/22/62 and Boss HP uplift; husky700/skunk4600.
- src/config/combat.ts ? new shared style/default-held-weapon/rarity-scale tables.
- src/core/types.ts ? summons/craterHits and animation/event fields.
- src/core/GridSystem.ts ? solo ownership/placement and canonical player-path interpolation.
- src/core/BattleEngine.ts ? no opponent runtime/setup, player-only waves/resources/commands, atomic redraw, tool use/store/repair, solo results and combat feedback.
- src/core/PropSystem.ts ? capped tool draw pool support, tool target filtering/recycle, slow regeneration, solo risk relics and dynamic rescue endpoint.
- src/core/BossMechanics.ts ? map-dependent summon clamp.
- src/core/CombatRules.ts ? safe range for tools/unknown optional kinds.
- src/core/MergeSystem.ts ? bench tool swaps with no merges or board swaps; side validation preserved first.

Tests changed: grid, battle, balance-v2, combat-details, merge, m2-props, m2-weapons, m3-maps, m3-bosses and p1-core; new p2-core. The m2-meta and m3-progression suites were run unchanged. Runtime AI tactics were replaced with explicit per-rank no-AI regressions; offline opponent configuration legality tests remain as inert compatibility checks. Unrelated weapon, skill, damage ownership, status, storage, profile backup, migration and tutorial reward assertions were retained.

## Exported interfaces and integration contract

- maps exports GRID_COLS=6, GRID_ROWS=7 and exact STAGE. getMap(id).paths.player is canonical. paths.ai aliases the same route only for compatibility and never causes simulation.
- units exports getSummonCost(summons), defined as10+2*summons. SideState.summons starts0 and advances only after affordable successful redraws; failed redraw preserves pack, count and food.
- UNITS.shovel is category tool, weight10, maxLevel1 and zero attack stats; DRAW_POOL includes it. One pack permits at most two shovels. No attack or merge path treats it as combatant.
- BattleState.craterHits is Record<string,number>, key col,row. First repair sets1, completion removes the key, and fresh Boss damage clears stale progress.
- BattleEngine.move(toolId,boardTarget) consumes a bench tool on valid G/B use. G becomes O; B takes two total tools across pouch/bench combinations. Pouch dig spends up to remaining repair cost, so a single available shovel advances1/2. Invalid targets consume nothing.
- BattleEngine.storeShovel(id) stores a valid bench shovel only below getShovelRules().maxStored. Tool dig/store results omit unitId because the source was consumed. Bench tool swaps preserve both cards; moving a board unit onto a bench tool fails before any mutation.
- New result keys: hint.repairProgress, hint.shovelStored, hint.shovelFull, hint.toolOnly. UI owns translations and selection clearing. Active prop filtering happens before cooldown payment; recycle returns4 food for a bench shovel and5 for existing eligible units.
- Unit has optional attackAngle, facing (1|-1), attackAnim. Each attack snapshots angle/facing, sets animation1 and decays by dt*3.1. Enemy optional knockX/knockY are5px direction offsets, cleared when hitFlash expires.
- VisualEvent adds slash/hit/death/food. Slash stores origin, target point, source id and style effect. Samurai remains COMBAT_STYLES.samurai_doge=cleave180 with slash effect heavy_cleave. Other melee effects are spin360/cleave180/cross_slash/thrust. Ranged/magic projectile.effect=unit.kind. Hit/death effects are vfx_hit_burst/vfx_dust_puff; food value is1 or8 at death position. Existing real instantaneous damage, ultimates, proc attacks and retained DOT ownership are preserved.
- combat exports AttackStyle, COMBAT_STYLES, DEFAULT_HELD_WEAPONS and WEAPON_RARITY_SCALES=[1.05,1.15,1.26,1.38,1.52]. Bee/tools have no attack style or held weapon; components retain their small ranged attack and have no held weapon.
- Orange loss, rescue landing/trigger/clear radius, sprinkler reversal and Boss summons all derive from the current map route. Exact matrices/routes plus arrivals, rescue/summons and visual orange endpoints are tested on all four maps.
- Legacy Side/EngineOptions.ai/aiOverrides and empty AI side/result fields remain for migration callers. No OpponentAI is constructed or ticked. Explicit AI resource/card/prop/Boss commands reject or no-op. Direct spawnEnemy(kind,ai) returns a detached inert id0 object without changing state or sequence; it is never inserted into enemies. AI damage/DOT cannot mutate resources/events.
- Victory after wave10 clearance uses player orange survival; win coins are rank.winCoins+min(45,floor(food*0.5)); winner loot is exactly player loot. Loss uses legacy ai winner sentinel with0 coins and no awarded loot. Legacy result.playerLoot records the run bag; result.aiLoot is empty. Existing storage award receipt deduplication and victory-only fragment/free-ticket policy stay unchanged.

## Concerns and review notes

1. Original basic/component draw weights total100; adding the mandated shovel weight10 yields9.09% raw per-slot chance before the two-tool cap, while the spec describes about9.5% using an approximate105.5 total. Exact existing weights and the explicit weight10 requirement were preserved; no unrelated pet weights were silently changed.
2. P1 opponent configuration/OpponentAI files remain available to legacy imports and tests, but BattleEngine has no construction or runtime dependency on them (OpponentTuning import is type-only). They can be removed separately if migration compatibility is intentionally dropped.
3. Visual damage is immediate in core and snapshots event coordinates; removing a source during the visible attack cannot cancel already-applied damage. Existing DOT-after-source-removal weapon-proc regressions remain green. Canvas rendering must consume event snapshots and fall back when optional art is unavailable.
4. No manual balance tuning beyond the explicit spec numbers was performed. Final natural10-wave completion is covered with a strong solo array; human play difficulty remains part of browser/product QA.
5. Full-suite failures below are expected integration work for Task2/Task3, not suppressed checks. There are no remaining owned logic failures.

## Remaining cross-layer failures

- m2-render.test.ts: 27 failures
- m3-render.test.ts: 13 failures
- p1-render.test.ts: 23 failures
- p1-ui.test.ts: 2 failures
- render.test.ts: 3 failures
- ui.test.ts: 1 failures

Every failing full test name from the final JSON evidence:

- **m2-render.test.ts** ? M2 stored path rendering moves dash through each recorded segment after source and targets disappear ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering reaches all 7 dash endpoints in order ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering reaches all 10 dash endpoints in order ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering does not jump to the final basketball target at the first bounce ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders yarn on the second segment and clamps expired events to the last point ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering drives the sprinkler from the tub backwards around road corners ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering lands the giant orange cat at the event destination with no live enemy ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders a visible weapon theme for bamboo ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders a visible weapon theme for fish ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders a visible weapon theme for claw ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders a visible weapon theme for fire ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders a visible weapon theme for vacuum ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders a visible weapon theme for unknown_future_effect ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders treasure using its own weapon theme ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders electric using its own weapon theme ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders coin using its own weapon theme ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders bubble using its own weapon theme ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 stored path rendering renders wave using its own weapon theme ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools shows the equipped sniper range rather than the old base range ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools uses yarn orb seven-hit charge for the visible energy bar ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools shows corrugated box, warning mark and animated packing tape on SEALED ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools shows a dark cloud and animated droplets above WET units ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools shows a rotating washer around washing bench units ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools shows golden shovel even when it is not selected and displays trap charges ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools highlights road targets and draws a prop cursor without changing hit targets ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools does not mark an already trapped road cell as a valid placement ? TypeError: Cannot read properties of undefined (reading '0')
- **m2-render.test.ts** ? M2 status, props and tools draws valid bench prop targets above the opaque nest backgrounds ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws sunny_backyard palette and follows its own route ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws sakura_onsen palette and follows its own route ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws midnight_kitchen palette and follows its own route ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws cat_tower_maze palette and follows its own route ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration hides only damage text, retaining projectile and skill geometry ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration renders confusion as a spiral rather than another knockdown star ring ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws a recognizable diva_kitty silhouette and captured skill targets ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws a recognizable buff_roo silhouette and captured skill targets ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws a recognizable hornet_queen silhouette and captured skill targets ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws a recognizable screaming_marmot silhouette and captured skill targets ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws a recognizable trash_coon silhouette and captured skill targets ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration draws a recognizable dj_rat_king silhouette and captured skill targets ? TypeError: Cannot read properties of undefined (reading '0')
- **m3-render.test.ts** ? M3 canvas integration gives killer bees, charmed rats and bone shields visible identifying marks ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 map and object pipeline keeps sunny_backyard image uncovered by static tile blocks, with visible open and broken cells ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 map and object pipeline keeps sakura_onsen image uncovered by static tile blocks, with visible open and broken cells ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 map and object pipeline keeps midnight_kitchen image uncovered by static tile blocks, with visible open and broken cells ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 map and object pipeline keeps cat_tower_maze image uncovered by static tile blocks, with visible open and broken cells ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 map and object pipeline draws tile aliases and all object images while retaining a live orange stack ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 map and object pipeline omits legacy rival text only when an opponent identity is supplied ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases highlights all valid board and bench upgrades from a selected source ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases highlights all valid board and bench upgrades from a dragged source ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives hero recipe targets gold double rings, stars and a merge capsule in both zones ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases suppresses merge suggestions in tool mode {"shovel":true} ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases suppresses merge suggestions in tool mode {"propId":"washer"} ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives kungfu_po gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives bamboo_mafia gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives zen_master gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives puss_in_hat gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives meowfia gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives purrcerer gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives samurai_doge gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives doge_wick gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives ronin_goose gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives ballin_rooster gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives rocket_coon gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-render.test.ts** ? P1 complete merge targets and hero bases gives pepe_king gold disks and near-full energy rings on board and bench ? TypeError: Cannot read properties of undefined (reading '0')
- **p1-ui.test.ts** ? P1 player presentation selectors keeps preparation, wave and boss progress bounded and distinct ? AssertionError: expected { kind: 'preparation', …(2) } to match object { kind: 'preparation', …(2) }
- **p1-ui.test.ts** ? P1 tutorial command integration keeps step 2 after a bench merge and empty-bench move, then advances after a real board deployment ? AssertionError: expected { ok: false, …(1) } to match object { ok: true, key: 'hint.deployed' }
- **render.test.ts** ? renderer drop targets maps board corners to the correct grid cell and excludes the outer edge ? AssertionError: expected { kind: 'cell', col: 5, row: 8 } to deeply equal { kind: 'cell', col: 7, row: 9 }
- **render.test.ts** ? renderer drop targets keeps the five nests separate, including the gap between them ? AssertionError: expected null to deeply equal { kind: 'bench', slot: +0 }
- **render.test.ts** ? renderer drop targets uses a circular shovel target and safely rejects non-finite coordinates ? AssertionError: expected { kind: 'cell', col: 5, row: 8 } to deeply equal { kind: 'shovel' }
- **ui.test.ts** ? live localization has both language entries for every unit, skill, boss and reward shown by the game ? AssertionError: unit.shovel: expected 'unit.shovel' to not deeply equal 'unit.shovel'
