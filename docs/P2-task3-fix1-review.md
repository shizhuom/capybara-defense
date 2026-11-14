# P2 Task 3 integration fix 1 review

Scope: only `docs/P2-task3-fix1-diff.txt`, the appended implementation report, and necessary label/toast context. Source, index, HEAD, server and design remained read-only. No tests were rerun; accepted the reported 62 affected tests and successful typecheck as evidence.

## Verdicts

- **Specification: CHANGES REQUIRED.** The nest/tool collision is addressed. The toast/action collision remains at a supported intermediate viewport.
- **Code quality: CHANGES REQUIRED.** The desktop-only media condition leaves the same responsive layout defect below its breakpoint. No other new regression found in this narrow change.

## Findings by severity

### Medium — toast still overlaps summon below the new breakpoint

**Location:** `src/ui/p1.css:120` (`@media(min-width:1100px)`), with the bottom-centered fallback at line 118.

**Status: NOT FULLY ADDRESSED.** The gutter placement prevents stage overlap at widths of 1100px and above, but the fallback still crosses the actions when the stage is constrained by viewport height at narrower desktop/tablet sizes.

Root confirmed the concern with a real-browser assertion at **1024×900**:

- Toast: x431, y857, width162, height35, bottom892.
- Summon: x414.06, y795.81, width226.45, height74.80, bottom870.61.
- The rectangles intersect in both axes, obscuring roughly 13.6px of the action vertically. Root captured `verification/p2-browser-failure.png`.

Use toast placement that avoids the action region across the responsive range, then retain an intersection assertion for this viewport as well as the existing desktop/mobile checks. A passing 1100px+ layout alone does not close the original collision finding.

## Original findings disposition

1. **Nest heading / occupancy collision with sprinkler and pouch: ADDRESSED at source level.** `src/render/StickerRenderer.ts:405` places the heading at x144 with a 304px maximum width (ending at x448), and the count ends at x500. This reserves separation between the labels and avoids the toolbar tool shapes while preserving y930 and all input geometry. The focused regression covers both languages and empty/full occupancy. Final screenshot acceptance remains root-owned.
2. **Desktop toast crossing bottom summon: PARTIALLY ADDRESSED / OPEN.** The new gutter rule solves its covered desktop range, but the browser-confirmed 1024×900 case above still fails.

The English tutorial screenshot and refreshed visual inspection remain root-owned pending checks; this rereview does not claim to have performed them.
