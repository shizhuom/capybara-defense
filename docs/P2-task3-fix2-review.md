# P2 Task 3 integration fix 2 review

Reviewed only the toast fix in `docs/P2-task3-fix2-diff.txt` against the prior staged tree `e587ada84232c73a62a263fe87ffee9f4ca7ea8b`, the appended Task 3 report, and the refresh/label context needed to assess regressions. No source, index, HEAD, server or design mutations; no subagents or test-suite reruns.

## Verdicts

- **Specification: PASS at source level.** The remaining toast/action overlap is addressed across the responsive placement branches. Root retains final real-browser intersection and screenshot verification.
- **Code quality: PASS.** No actionable findings in this scoped change.

## Finding disposition

**Previous medium finding — toast overlaps summon at 1024×900: ADDRESSED at source level.** `src/ui/GameApp.ts:344` replaces the fixed breakpoint with the actual stage rectangle and viewport dimensions. A readable right or left gutter gets explicit width and 16px separation from both stage and viewport edges. This handles the previously failing 1024px case without depending on viewport width alone.

With no side gutter, the code measures height after setting text and width, retains bottom placement only when it clears the stage, and otherwise places the toast at the upper board. This avoids the bottom action strip while preserving stage/input geometry. The fallback may briefly cover combat art; this is an explicit, limited tradeoff when exterior space is unavailable, and pointer events remain disabled.

## Regression checks

- Placement resets all branch-dependent coordinates before measuring, preventing stale side/top positioning after resize or language changes (`src/ui/GameApp.ts:356`). Developer mode clears the inline placement at line 346.
- The existing frame loop refreshes every 120ms in playing, paused and menu states (`src/ui/GameApp.ts:217`), so visible notices are repositioned after viewport changes without requiring another command.
- Focused tests cover 1440, 1024, 900, 800 and 390px fixtures, wrapped notices, resize to 390×600, and translated content. Accepted the supplied six-case RED evidence, **37 relevant passing tests**, and successful typecheck. These boundary fixtures support the source verdict; they do not substitute for actual browser geometry.
- The accepted round-1 nest labels are untouched. No new storage, identity, reward or command-routing behavior is introduced.

## Pending root verification

Root is rechecking actual toast/action rectangles at 1440, 1024, 800 and 390px widths, plus English tutorial screenshots. This reviewer did not run or claim those browser checks. No remaining source-level blocker was found.
