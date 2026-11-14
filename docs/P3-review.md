# P3 代码复核归档

日期：2026-11-14。最终结论：**可验收，无遗留阻断或搁置项**。

四个实现任务分别通过需求与代码质量复核。曾发现的准备期橘子伤害保留、属性图标、移动卡片字号和交互问题均已修复。整条分支初审提出一项手机文字可读性问题；同一修正批次补齐字号，实机还发现并修复了教程气泡换位导致的触摸点击穿透。下方初审的 With fixes 是历史结论，最终针对性复核已确认全部解决。

功能实现最终提交：b84463b；验收证据提交：0b6f6de。762/762 测试、类型检查、生产构建、14 组主浏览器回归、9 组移动排版/教程检查、成品及存档恢复验证均通过。实施取舍及其代价见 [交付验证](P3-verification.md#需求冲突与实施取舍)。

## 整条分支初审原文（历史）
# P3 whole-branch final review

Reviewed 2026-11-14. Base `db300572cd6131e570575a2c3c8385e488a0fa96`; head `b0be20c34f61fbaaddc9535949a058bb4fc7d02d`. HEAD matches the requested review revision; the checkout was clean before this report. This was the single broad review, performed without subagents or checkout/index/HEAD changes.

## Strengths

- The four maps and STAGE constants match the supplied geometry. The renderer uses the full map image before board overlays, dynamic endpoints, shared hit coordinates, and a peaceful preview without simulating a battle. The revised regression fixtures retain their original behavioral assertions while adapting coordinates.
- Preparation synchronization is owned by the engine and guarded by a permanent first-enemy latch. Defensive loadout copies prevent profile aliasing; resource, cooldown, rescue-use and unit state survive swaps. The orange-deficit correction preserves damage through zero-floor round trips, and overtime food is granted only once. The UI adopts shop/profile changes after successful saving, preserving rollback behavior.
- Base and effective stat helpers connect actual combat cadence, bee production and UI displays. The compendium distinguishes real level limits, base growth, signature equipment and recommendations. Live cards use the active battle snapshot, actual merge legality and incremental stat/energy/status updates.
- Enemy locomotion is a small rendering-only module with bounded state and dust lifetimes. Facing, route-derived phase, missing-art fallback, pause/stun behavior and cleanup are covered without introducing gameplay events.
- P2 economy, solo settlement, props, held weapons, save namespace and relative production assets remain integrated. The browser scripts exercise real input and transactions in isolated contexts; the delivery report clearly distinguishes browser mobile emulation from physical-device validation.

## Issues

### Critical (Must Fix)

None found.

### Important (Should Fix)

1. **Remaining player-facing text shrinks to approximately 7–10px in the required phone landscape viewport.**
   - **Files:** `src/ui/p3.css:23`, `src/ui/p3.css:29`, `src/ui/p3.css:36`, `src/ui/p3.css:41`, `src/ui/p3.css:43`, `src/ui/p3.css:69`, `src/ui/p3.css:70`, `src/ui/p3.css:75`; the same sizing pattern also affects tutorial copy/skip controls at `src/ui/p3.css:114` and `src/ui/p3.css:115`.
   - **Trigger and evidence:** At the required 844×390 viewport, the 16:9 stage is approximately 693.33px wide, so `1cqw` is approximately 6.93 CSS pixels. The map-chip and profile labels at `1.25cqw` become 8.67px, language buttons at `1.2cqw` become 8.32px, hub labels at `1.4cqw` become 9.71px and collection/ticket numbers at `1.1cqw` become 7.63px. Boss name text at `1.05cqw` becomes 7.28px and HP/skill text at `.95cqw` becomes 6.59px. The latter is visibly tiny in the supplied `verification/p3-mobile-landscape.png`. The landscape overrides at lines 172–191 floor card and selected HUD text, but omit these selectors. This conclusion follows from the final CSS cascade and saved screenshot; no broad rerun was needed.
   - **Why it matters:** Readable phone landscape UI is a central P3 requirement, and specification section VI explicitly forbids player-facing body/corner text below 12px. Players need map names, navigation labels and Boss information during ordinary play. The corrected live card is readable, but the same problem remains elsewhere in the new UI. Tutorial body/skip text also uses the same unbounded scale, making first-run guidance difficult to read on the target phone size.
   - **Fix:** Apply physical font-size floors to the remaining player-facing HTML text and reflow or compact the affected docks where necessary. Preserve the exact canvas/STAGE geometry; do not enlarge typography into overlapping top controls. A compact Boss layout can prioritize readable name/HP and use the skill progress strip without a microscopic caption. Check both languages at 844×390, including the scenic menu and tutorial as well as combat.
   - **Focused verification:** Add browser assertions for computed font sizes of these actual visible selectors, and check containment/no overlap plus genuine clicks on the menu/tutorial controls. Current browser typography assertions cover the live card only, so the green report does not catch this gap.

### Minor (Nice to Have)

None recorded. I did not convert formatting preferences or harmless retained compatibility code into findings.

## Plan alignment and rulings

- **All 20 existing props retained:** Accepted. The specification's isolated count of 10 conflicts with its instruction to preserve the existing catalog and offers no deletion list. Retention avoids a P2 feature regression.
- **One signature plus two labeled recommendations:** Accepted. The implemented catalog has one real signature per hero. The UI presents the additional weapons honestly rather than inventing awakening behavior.
- **True level caps and growth:** Accepted. Components remain level 1, bees remain level 1–3, basic combat pets use the specified five multipliers, and heroes retain their existing growth. Unavailable stages are explicit. Engine/display agreement is more useful than showing impossible upgrades.
- **Map unlock progression:** Accepted. Visible locked chips and existing automatic selection preserve progression; unrestricted developer selection remains a testing facility.
- **Portrait card in lower letterbox:** Accepted. It preserves the 16:9 board and selected-unit accessibility while providing readable text, touch buttons and internal scrolling. The supplied 390×844 screenshot supports this decision. Portrait-only Boss/control spacing is also supported by the evidence, though the remaining text-size issue above still applies to the broader presentation.
- **Resource-preserving preparation changes:** Accepted. Permanent spawn locking, one-time grants and consumed-resource preservation prevent equipment toggling from farming resources. The orange damage ledger and defeat-on-resume behavior are coherent and specifically tested.
- **Existing workspace/native PowerShell workflow:** Accepted. This respects the user's strict directory boundary and has no product behavior cost that requires a change.

## Review coverage and evidence

Read the authoritative design specification, the full implementation plan and ledger rulings, and all text code/configuration/script/documentation/test diffs in the packaged range. Initial long outputs that truncated were reread in bounded sections. Inspected relevant unchanged integration code in MetaScreens, WeaponSystem, MergeSystem, unit configuration, storage and Vite configuration.

Inspected saved desktop menu/combat, English combat, matrix, pets, landscape phone and portrait phone screenshots. These support the visual improvements and the one remaining readability finding above. Reviewed the verification scripts themselves so their claims can be evaluated against what they actually exercise.

Read the generated evidence summaries:

- `verification/p3-tests.json`: success, 757 passed, 0 failed, 0 pending.
- `verification/p3-browser-report.json`: 14 recorded checks, no failure, zero console/page errors.
- `verification/p3-production-report.json`: actual production without debug API, portrait interaction/settlement/reload and subdirectory resource checks, zero errors.
- `verification/p3-profile-switch-report.json`: four passing profile-switch scenarios, including failed-save preservation; zero errors.
- `verification/p3-isolation-report.json`: 2331 protected files, no changes or additions; 166 source PNGs and manifest entries; no source hash mismatches; exact manifest match; four 1280×720 maps; no parent tracked changes.
- `docs/P3-verification.md`: typecheck/build exit 0 and final evidence after the latest source change, as supplied by the executor. I did not rerun those suites or browsers.

Additional interactions considered and accepted: empty preparation slots opening the shop; nested armory/market switching; prior pause-state preservation; guide deep links and tab scroll reset; live-card touch scrolling; hiding cards during drags; selection clearing; shovel storage; real merge readiness including washing/locks/levels; legacy keyboard board access in the developer drawer; fallback art; and retained P2 test assertions for combat/economy/tools. No separate correctness finding arose from these checks.

## Recommendations

Resolve the one typography finding with a focused responsive change and a small browser check across the affected screens. Keep the already verified geometry, battle-state and persistence paths unchanged. No further architectural rewrite, dependency addition or broad second review is warranted by this review.

## Declined to judge

- Native WeChat/Bilibili mini-game packaging, APK behavior, physical Android/iOS browser chrome and device-specific performance: this delivery is a local browser game with a manifest and mobile emulation evidence, not a native packaging/device-validation milestone. The delivery report states this boundary.
- Long-term balance across all 54 ranks after the required route and basic-damage changes: the plan specifies the numerical changes and preserves the remaining economy; an empirical progression rebalance requires playtesting and an additional balance objective. This review did check numerical consistency and existing combat regressions.
- Repainting or independently redesigning the supplied artwork: the task requires exact source assets. Source-hash, dimensions, registry and rendered integration evidence were reviewed; replacing the art would violate the asset requirement.
- Full screen-reader equivalence for the Canvas game and a new clean-mode keyboard interface: the plan specifically preserves the existing keyboard interaction route in the developer drawer. This review checked that preservation and accessible labels on the new HTML controls, without expanding P3 into a separate accessibility redesign.

## Assessment

**Ready to merge? With fixes.**

The implementation is coherent across core, renderer, UI and persistence, with substantial behavioral and release evidence. One Important issue remains in a primary acceptance area: the required phone landscape view still renders several new player-facing text groups far below the specified minimum. Fix that focused presentation gap before treating P3 as fully accepted.


## 修正后的最终复核原文

- **Remaining player-facing text shrinks to approximately 7–10px in the required phone landscape viewport** — **ADDRESSED**. `src/ui/p3.css:23`, `:25`, `:29`, `:36`, `:41` and `:43` floor menu/profile/language/map/hub/count text at 12px; `:39` floors Start at 24px. `src/ui/CourtyardView.ts:16` supplies compact localized map labels with full localized accessible names and unchanged selection actions. `src/ui/p3.css:69`, `:70` and `:228` preserve readable Boss name/HP; the compact skill strip replaces its microscopic caption and retains localized accessible progress in `src/ui/GameApp.ts:424` and `:434`. `src/ui/p3.css:114`, `:115`, `:116` and `:235` floor tutorial body/skip/acknowledge text and provide wrapping/scrolling above the bottom dock. Portrait reflow at `:171`, `:192` and `:198` uses the controller-authorized letterbox space. Saved measurements confirm every affected visible text group is at least 12px in Chinese and English at 844×390 and 390×844.

### New Breakage in the Fix Diff

- **None found.** The pointer-origin guard in `src/ui/GameApp.ts:754`, `:816` and `:828` restricts only pointer-generated tutorial skip/acknowledge clicks; canvas-origin compatibility clicks are rejected, fresh button activation remains valid, and keyboard/assistive detail-0 activation remains valid. No core rules, renderer/STAGE coordinates, nest/bell hit geometry, persistence paths, port or dependencies change in this fix range.

### Checks

- Reviewed the supplied `b0be20c..0b6f6de2769cba03ca8d7a583dd8b32ef2879544` package, task brief, original finding, exact design source and implementer report. Review remained limited to the finding and fix changes; no second broad review, subagents, checkout/index/HEAD changes, suite runs or browser reruns.
- Checked `tests/p3-ui.test.ts:54` and `:70` against the stored passing assertions: actual controller deployment leaves Step 3/reward pending after the retargeted pointer click; a fresh button gesture and detail-0 acknowledgement complete normally. The five added localization/accessibility/input assertions are all recorded as passed in `verification/p3-tests.json`; its totals are 762 passed, 0 failed, 0 pending.
- Checked `scripts/p3-mobile-typography-qa.mjs:15`, `:21` and `:37` against its generated report: 9 passing groups, no errors/failure; bilingual menu, three tutorial steps, Boss/status/badge measurements all have 12px minima, with genuine touch summon/deploy/acknowledge and geometry assertions. Visually inspected saved landscape Chinese menu, landscape English tutorial/Boss, and portrait English menu/tutorial screenshots; they support the measured readability and accepted placement.
- Checked stored release evidence: main browser 14 groups/0 errors; production and subdirectory checks/0 errors; all four profile-isolation cases passed; isolation report has 2331 protected files unchanged, 166 exact PNGs, matching manifest and four 1280×720 maps. `docs/P3-verification.md` records typecheck/build exit 0 after the final source changes. These are inspected existing results, not independent reruns.

### Out-of-Scope Observations

- **None.**

### Verdict

- **Fix round: All findings addressed, no new Critical/Important breakage. Ready for P3 acceptance.** No original finding remains open.
