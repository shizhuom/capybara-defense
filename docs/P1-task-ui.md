# P1 Task 4 — player UI and integration

Authority: readonly `D:/rea_game/design/codex_p1_polish_spec.md` sections1/2/5 plus interfaces in P1-contracts.md. All mutations only in game directory, preserve4175/prefix/M1–M3 transactions and test-profile identity isolation.

- Default pure player view hides sandbox/journal/footer, centers exact640×1386 stage, fits390×844 without page scroll; settings developerMode persists, querydev=1 overrides and explicit off removes query.
- BossHUD chooses nearest live player-lane Boss, count, real HP and ability cooldown; wave progress preparation/normal/Boss colors. Opponent banner uses engine identity localized names/avatar/rank.
- First-battle tutorial follows real successful summon→deploy/dig→merge/ack, can skip, doesn't pause/capture game. Finish20coins persists-before-adopt once; replay retains claim. Test-profile transition clears engine/tutorial together after success only.
- Four encyclopedia tabs show12heroes/12Boss/36weapons/20props, localized formulas/stats/skills/mechanisms/countertips/family/unlock/awakening/price/cooldown; merged heroes gold.
- All HTML props/unit views use asset helpers; readiness refresh must not reset lottery or captured drags. Menu/banner/logo, avatars/weapons external art supported.
- Select SoundManager modes by menu/battle/Boss and preserve duck/lifecycle and command/event ownership; settings retain volumes/damage/bilingual choices.
- Vitebase='./'; ignore runtime/verification/backups watchers to prevent Windows EBUSY from QA artifacts. Update existing browser scripts only for devquery/newcanonicalcue/PNG-or-SVG expectations.
- Tests: meaningful pureHUD/compendium/i18n; actual browser390×844, desktop, tutorial reward, settings, halos, liveBoss, all80bookentries, fourmaps, metatransactions, zeroerrors. Production relative-path/fallback verification belongs final integration stage.

Own files: docs/P1-ui-review-diff.txt lists root changes. Review code only, do not modify it or run full suites. Report spec and quality separately to docs/P1-ui-review.md with file:line evidence for important findings.
