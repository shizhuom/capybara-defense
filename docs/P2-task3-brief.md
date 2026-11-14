# P2 Task 3 Brief

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

## Task 3: Solo UI, bilingual copy, tutorials and input

**Ownership:** `src/ui/` (except sound modules unless new visual events need cue routing), `src/i18n/`, `src/config/props.ts`, UI/i18n tests and new `p2-ui.test.ts`. Do not edit core/render.

**Interfaces:** Consume getSummonCost, move tool action, storeShovel and keys from Task1; use exact STAGE for overlays/input. Existing profile migration and test identity transactions remain.

**Confirmed integrations:** Core checkpoint8f188d4 passed424logic tests/typecheck and independent review. Renderer consumes new `render.dig` key with exact中文`铲`/English`DIG`; partial repair is numeric1/2. Add `unit.shovel` and inspect tool-specific copy as well as `hint.repairProgress`, `hint.shovelStored`, `hint.shovelFull`, `hint.toolOnly`. Core tool success omits unitId because consumed. All UI entrypoints (canvas click, pointerup, keyboard) must support pouch storage. Current pointerup explicitly ignores hit.kind==='shovel', which must change. Clear consumed selection synchronously. When hint.noFood is displayed, provide current dynamic shortage/cost variables, never a fixed10 or unresolved placeholder. Task1 retained inert legacy ai fields only; there is no opponent setup or runtime. Do not resurrect AI in UI for fixtures.

Root browser QA is prepared at scripts/p2-browser-qa.mjs and production counterparts; do not run servers/browser yourself. Current remaining UI failures p1-ui2 are old prep20 and old deployment coordinates, ui1 is missing unit.shovel translation. Root will run full integration/browser review after your source-level gate.

Task2 now owns adding only render.dig in zh/en (dependency resolved for its bench-tag test); preserve those entries. When enabling pouch drops, retain harmless cancellation for a dragged ordinary pet dropped over the pouch; only a bench shovel should trigger storage. Actual pouch click with a selected shovel is storage; ordinary pouch click still toggles digging mode.

- [ ] RED tests for live summon cost/shortage/redraw, translations/no stale PvP text, new tool command routing, tutorial save/dedup, no opponent banner/AI loot column.
- [ ] Canvas640×1216; clean stage640/1216, center width min(calc((100dvh - 58px) * .526316),calc(100vw - 18px),520px). Update all CSS absolute percentages, tutorial anchors and keyboard cells from dimensions.
- [ ] Remove opponent markup and refresh logic; solo pause/result loot and wording. Retain ranks/leaderboard as honor showcase. Dev boss command spawns one player Boss; include shovel grant.
- [ ] Route bench shovel select/drag onto G/B through move, onto pouch through storeShovel (including pointerup currently ignored at pouch); consumed selection clears; invalid/full operations show specific toast. Tool inspector avoids combat stat access. Apply shovel SFX/tutorial progress to partial repair.
- [ ] Update shared_oranges to温泉加餐券/Hot Spring Feast Pass (+4 orange,+15%enemyHP), hyper_party(+38%attack/+12%enemySpeed), auto_shovel30s/cap6, guides55s/cap4 and escalating10→12→14. Add hint.redrawn exact translations. Add all new tool/repair/DIG keys.
- [ ] Run owned tests and relevant sound tests; root reviews diff.
