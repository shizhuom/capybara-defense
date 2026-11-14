# SDD ledger — plan: docs/P2-implementation-plan.md

Baseline: P1 commit319ea6c / tagv1.0-p1; game independent repository. Spec fully read before product changes. Current branch to be p2-solo-overhaul. Existing576tests passed at preceding checkpoint.

## Preflight

| Tasks | Interface or consistency check |
| --- | --- |
| Core/render | Exact STAGE, combat config, optional unit attack fields, slash/hit/death/food events defined by core; renderer consumes, no damage mutation. |
| Core/UI | move routes bench tool, storeShovel explicit method, crater keys col,row, dynamic cost helper and 4 new result keys agreed. |
| Render/UI | 640×1216 coordinate model, pouch556,898, nest944; UI overlays derive same constants; only root runs browser. |
| Art/render | Root copies145images/manifest; renderer consumes shared loaded-only registry and expands dictionary/tests. |
| Core itself | Loss rewards0 allowed by spec, old winner ai sentinel inert; all map endpoints dynamic. Owned tests replace removed behavior, no global skip. |
| Render itself | No mounted tools on bench/components, fallback paths preserved; VFX are visual only. |
| UI itself | Solo strings overwrite old copy; legacy profile and one-time reward transactions preserved. |
| Verification | All writes inside game, server4175 unchanged; current source art hashed read-only. |

Ruling: Supplied detailed spec and explicit implementation request authorize implementation without another design/plan approval. Keep the existing technical stack and independent game repository; use a local implementation branch, no outside worktree — alternative workflow would add unnecessary directories outside the user boundary.
Ruling: Keep inert legacy ai-shaped state/result fields if useful, but prohibit active AI simulation and new ai commands. Loss uses existing ai winner sentinel and0coins; no AI loot can enter settlement — removing every historical type would increase migration/test churn without changing solo behavior.
Ruling: Shovel recycle pays4 per spec; other Lv1 pets retain5. husky700 per example; other12BossHP rounds×1.15, skunk4600. These are the only specified numeric choices requiring interpretation.

## Status

- Task1 complete:424owned tests/35new P2tests pass; typecheck pass; full536pass69render/UI failures awaiting later tasks. /root/p2_core_review specPASS/qualityapproved, no Critical/Important. ReviewP2-task1-review.md.
- Task1 minor follow-up: m2-props gold_doge repair test still digs old invalid(1,8), missing valid repair assertion; carried into Task2 brief with exact(0,2) and success/no-treasure check.
- Task1 core committed8f188d4 onp2-solo-overhaul; P1tag319ea6c untouched.
- Task2 /root/p2_render initial143tests/typecheck pass; /root/p2_render_review requests fixes: capture slash size/enhancement/actualcritical metadata rather than live source/proximity; calibrate equipped weapon axes. Minor cross-slash windup also recorded for this related motion update. Carried gold_doge repair test confirmed fixed. Round1 assigned to original renderer implementer with limited core visual metadata scope.
- Task3 pending, brief already includes confirmed storeShovel/result keys and render.dig ownership handoff.
- Task2 round1 baseline staged tree:3a391c369ae46c1fe3f15fca9a278a0946c845ee. Root must stage returned fix source/tests then create scoped git diff against this tree for original reviewer; do not regenerate whole-task review or reimplement core.
- Task4 preparation:145sourcePNGs and exact manifest copied;4mapdimensions768×896;2298protectedfiles captured and unchanged. Root prepared P2 browser/production QA and updated active test:browser entry; scripts not yet run against completed P2.
- No parked findings.

Ruling: Task2 adds its two render.dig dictionary entries before Task3, because its visible bench-tag test otherwise has an artificial circular dependency on later UI work. Task3 will preserve these keys; cost if wrong is only relocating two dictionary entries.

Ruling: Preserve existing pet weights totaling100 and add the explicit shovel weight10. Actual raw slot probability is10/110≈9.09% (before pack cap), while spec's9.5%/105.5 total is approximate. Reweighting pets would alter unspecified recipe odds; if9.5%exact is desired, the pool needs a separate approved balance change.

- Task2 complete (commits8f188d4..c9bc029, review clean). Round1 resolved both Important issues and related Minor;153affected tests/typecheck reported green, root diff-check clean. P2-task2-fix1-review.md PASS. Carried Task1 gold_doge repair-test Minor closed. Root removed no behavior; implementer fixed final EOF formatting before commit.
- Task3 starts fromc9bc029; UI brief isdocs/P2-task3-brief.md. No parked findings.

- Task3 implementer/root/p2_ui active fromc9bc029; RED evidence captured, UI/input then bilingual/CSS changes in progress. Root prepared actual touch/repair/storage and final-wave reward receipt QA; no P2 browser/full-suite claim yet.

- Task3 source gate complete: p2_ui_review PASS/spec+quality,100owned/668full tests andtypecheck. Root build succeeded; browser10groups passed with0errors. Screenshot review identified nest header/count overlap with sprinkler/pouch at y930; integration fixround1 assigned to UI owner with narrow renderer-label scope. Desktop transienttoast also crosses bottomaction area; move aside when room permits. No interaction failures.

- Task3 integration fixround1: nest header/count fixed and1440desktoptoast clear,62focusedtests/typecheck passed. Fresh full suite669passed. Reviewer raised1024×900toast; actual browser reproduced toast y857..892 overlapping summon y795.8..870.6. Round1 has1addressed/1open. Round2 will route notification according to available gutter instead of1100-only threshold; preserve exactstage andmobileview.

- Task3 complete (basec9bc029; sourcece97bf9 plusintegratedfixcheckpoint). Fixround2 reviewPASS, measuredguttertoast resolves1024issue; rootbrowserall10groupsPASS with1440/1024/800/390fit and0errors. Fresh fullsuite675passed27files; productionbuild/typecheckpassed. Root inspectedupdatedall4maps/ENtutorial/Boss/nestlabels/toasts. No parkedfindings; Task4 productionprofile/isolation/finalreview remain.

- Task4 production+subdirectory/meta/profile checks allPASS; isolation2298files/145PNGs+exactmanifestPASS. Finalwholebranchreview/root/p2_final_review: specPASS, qualityapproved,0Critical/Important,1Minor(validbenchshovelswapshowsred). One finalfixwave/root/p2_final_fix assigned withscope rendererpreview+focusedtests, baseline stagedtreefe785a7bdc76ee65e27cc191070ddcff2b66c7d0. No otherfindings; declined-to-judge listempty.

- Task4 complete: finalwholebranchreviewPASS andsinglefixwavereviewPASS;0openfindings/declineditems. Legalbenchtoolswappreview nowmatchesrealcommand;11regressionsadded. Finalnpmtest686/68627files;typecheck/buildPASS;latestproduction/subdirectory0errors;isolation2298unchanged/145sourcePNGs+manifestexact. Production4175updated. Intermediate reviewdiffpackagesremovedafterreviews; retainedreports,plan,ledger,andGitcheckpointskeepaudit. LocalP2branch/tagpreservedunderpriorversionsaveauthorization; no merge/push/publish. Alltaskchecklistscomplete.
