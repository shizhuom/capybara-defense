# P2 Task 3 review

Reviewed the staged Task 3 changes against `c9bc029`, the Task 3 brief/report, and the authoritative `D:/rea_game/design/codex_p2_solo_overhaul_spec.md`. Scope was UI, translations, prop descriptions and owned tests; core/render were considered only at the named command/config interfaces. No source, index, HEAD, server or design changes were made.

## Verdicts

- **Specification: PASS at source level.** The requested solo UI, exact stage/input geometry, dynamic summon copy, tool routing, bilingual text and tutorial integration are implemented. Final visual acceptance remains pending the root's real-browser screenshot inspection.
- **Code quality: PASS.** No actionable correctness or maintainability findings in the reviewed changes.

## Findings by severity

- **Critical / high / medium / low:** none.

## Evidence and interface checks

- `src/ui/GameApp.ts:129` takes canvas dimensions from `STAGE`; pointer conversion at line 643 uses the same dimensions. All 42 keyboard cells are generated from `STAGE.rows/cols` at line 478, with six CSS columns. Clean mode uses the required `640/1216` aspect and responsive width in `src/ui/p1.css:15`.
- Summon labels, accessibility text and shortage amounts use `getSummonCost(player.summons)` (`src/ui/GameApp.ts:310`). Failed-command toasts receive separate current cost and shortage variables at line 589. Failed redraw atomicity remains delegated to the already-reviewed core transaction and has a real-engine regression test.
- Bench shovels use `engine.move` for board targets and `engine.storeShovel` for pouch activation (`src/ui/GameApp.ts:616` and line 633). Click, native keyboard-button activation and drag release converge on that route. The drag guard at line 761 preserves harmless ordinary-pet pouch drops. Successful consumption clears a missing selected ID before notification at line 587; invalid/full operations preserve the selected tool. Tool inspection avoids combat-stat access at line 426. Partial repairs share shovel sound and tutorial progress at line 580.
- Opponent markup/render refresh and the AI pause-loot column are removed. The developer grant selector consumes `UNITS`, which includes shovel; its boss action consumes the core's solo `spawnBoss` interface. Compatibility translation keys have solo wording, and the exact redraw/DIG/tool translations and revised prop effects are covered.
- Tutorial anchors use `STAGE`, scan the full solo board, and exclude tools from merge candidates (`src/ui/TutorialView.ts:11`). The expanded refresh stamp tracks grid/unit changes and language. Persistence-before-adoption remains intact (`src/ui/GameApp.ts:411`); no storage namespace, identity transaction or reward algorithm changes were introduced.
- The new test harness isolates browser storage in memory per test. Its tutorial regression covers failed saving, retry, replay and reload without duplicate rewards; skipping persists without paying completion rewards.

## Verification boundary

Accepted the implementation report's **100 focused tests, 668 full tests and successful typecheck** as supplied evidence; no suites were repeated because review found no unanswered concern requiring a new run.

During review, root additionally reported a successful production build/typecheck and all 10 production-browser QA groups, including 390×844 fit, mouse/touch shovel flows, four-map combat, bilingual entries, solo pause/result, developer Boss, persistent final-wave rewards, fallback art and zero console/page errors. Those are root-reported automation results, not browser observations made by this reviewer.

**Pending root visual verification:** inspect desktop/mobile screenshots for tutorial bubble/spotlight fit after language changes, HUD/Boss spacing, shovel/tool overlays, sprinkler alignment at (84,898), and bottom actions spanning y1080..1188. No visual-layout defect is asserted from source inspection alone.
