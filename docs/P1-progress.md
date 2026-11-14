# SDD ledger — plan: docs/P1-implementation-plan.md

## Baseline

- Full P1 spec and overall design read before code. M3 baseline427/427 green at16:12:30.
- M3 source snapshot backups/m3-before-p1.zip339755bytes. Protected manifest verification/p1-protected-before.json2105files.
- Root git status unchanged: onlyexisting untracked design/ and games/. No AGENTS.md found in scoped repository search. Sprite source design/assets/sprites absent; pipeline must work with0external assets.

## Preflight

| Tasks/interfaces | Check and ruling |
| --- | --- |
| Core/assets | Core owns MergeTargets/types; assets consumes exact optional opponent and matchresults. No sharedwrites. |
| Core/audio | Existing event types kept, effects boss_spawn/treasure/sprinkler distinguish cues; rootUIowns commandcues. |
| Core/UI | Pure tutorial result only; UI uses existing save-before-adopt and dropsoldbattle ontestidentityswitch. Extra claimflag prevents replaycoinfarm. |
| Assets/UI | Shared loaded-onlysingleton; helpers independent of storage/i18n. RootUIrefresh doesn't reset transactions. Canvas fixedSTAGE, DOMscales. |
| Audio/UI | setMode exactcontract; UI choosesmenu foroverlays, boss iflive, battleotherwise; lifecycleM3fixes retained. |
| Each task | Ownfiles and tests align; no silentstub/placeholder allowed. Rootalone service lifecycle andCSS. |

Ruling: User's explicit P1 implementation and isolation scope authorize execution of the supplied design; no rootGit/worktreewrites or extra approval gate. Independent domains run in parallel with fixedfileownership and later separate reviews — wronginterface would require coordinatedmodule rework.
Ruling: Skipgrants0, replay preserves one-timeclaim, olderplayed profiles consume tutorialeligibility; sprinkler nowclearsSEALED asP1requires; externalartsourcecurrentlyabsent usescompleteproceduralfallbacks — alternateproductintent would require onlycorrespondingrule/UItests tochange.

## Status

- Task1/core: implemented /root/p1_core,49 newcoretests; /root/p1_core_review clean bothspec/quality. Complete.
- Task2/assets: complete; Round1 targetsymlink/ancestorjunction fix,10assettests pass and originalreviewer closedfinding.133PNGs syncedbyte-identical toreadonlysource.
- Task3/audio: complete;55soundtests incl21old +16manifest tests. Dev/build filtering implementsmissingoptionalfile zero404. Round1 outputjunction fixclosed byreviewer; no openfindings.
- Task4/UI+integration: complete features;17UItests pass. Round1 weaponunlock/armor/benchdeploy conditions closed byoriginalreviewer. P1browser8groups,additional4groups,realWAVoverride,fullM3browser,productionM1/M2/M3smoke,4profile-switchcases andrelative-subdir P1allpass,console/pageerrors0.
- Finalchecks16:55:576/576 tests24files, typecheck/build/sync133all exit0. Production4175 PID24124ready. Wholeimplementationreview /root/p1_final_review complete: functionality and quality pass, no new Critical/Important issues; cleanup remains blocked by environment. Independent tutorial save-failure/retry/reward-dedup check passed, original 427 tests retained. See docs/P1-final-review.md.
- Cleanup blocked byenvironment: recursiveRemove-Item autoapproval rejected, includingtwo separately verifiedliteralpaths. No attempt to bypass. OldM3andP1reviewcopiesremain; game-localClean-VerificationCache.cmd + guardedPowerShellscriptpreparedforuser. .runtimeignoredbyGitandVitewatcher.
- No parkedfindings. Do not repeat completed work after compaction; update this ledger.

Ruling: Keep preexisting immediate emergency sprinkler for enemyprogress>=13, while normalAI actions obey newopening delays — preserves acceptedM2 rescue behavior; changing this would require a balance/test update.
Ruling: Skip grants0 and keeps unused claim; firstcompletedreplay maygrant20, everylatercompletion0 — follows completion reward and prevents farming; alternative skipforfeitsrewardpolicy would change onlyhelpertests.
- Sourceupdate: externalreadonlydesign/assets/sprites appeared with133PNGs duringimplementation; copiedwithin game, unknownIDs0. No agent created/modified source.
- Tooling issue resolved: Vitewatched temporaryreviewbaseline Windowslockedfile andexitedEBUSY; ignore.runtime/verification/backups. Currentdev4175 unifiedexecsession24942, rootownsserver.
- Supersedes previousserverline: stoppedowndevsession24942viaCtrl+C;Start.ps1startedproductionPID24124,healthconfirmed. Startupwrapper47368mayretainhandles;donotterminateproduction.
- Isolation:2105initialprotectedfileschecked,2103unchanged;2readonlyP1designfilesexternallyupdatedandfullyreread.172newreadonlydesignfilesobserved,133sourcePNGsequalgamecopies. Roottrackedgitdiffempty. Evidenceverification/p1-isolation-report.json.
