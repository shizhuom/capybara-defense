# P2 Task 1 Brief

Read D:/rea_game/design/codex_p2_solo_overhaul_spec.md in full before editing. This brief is implementation scope, not a replacement for the authoritative spec.

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

- [ ] Write RED tests for exact maps/endpoints; no AI execution; victory/defeat and solo loot; cost 10/12/14/16 and atomic failure; shovel cap/dig/staged repair/store/filter/recycle; 55/30 regen; deterministic food; risk/reward relics; melee event contract/facing/decay/hit/death.
- [ ] Implement §2–3 exactly. Initial22 food,1 shovel; prep18; wave2+ income3; no wave shovels; kill1/Boss8; bee18/1,11/1,7/2. Shovel weight10 and pack cap2; recycle shovel4 food. shared oranges+4/HP×1.15; party rate×1.38/enemy speed×1.12. Boss HP×1.15 rounded; husky700, skunk4600. All other specified wave values verbatim.
- [ ] Keep `Side='player'|'ai'`, legacy result fields and `EngineOptions.ai` only if useful to avoid migration churn; no AI creation, waves, runtime or UI. Explicit AI commands must not mutate the solo battle. Loss winner may retain legacy `'ai'` sentinel without opponent simulation. Loss coins choose0 (spec permits original victory-only loot/reward policy).
- [ ] Update affected existing logic tests to real P2 positions and rules, retaining unrelated assertions; replace removed AI behavior tests with explicit no-AI regression tests. Do not skip broad tests merely to get green.
- [ ] Run owned logic tests, report RED/GREEN and remaining cross-layer failures. Root packages diff and requests task review.
