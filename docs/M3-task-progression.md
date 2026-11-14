# Task 1：段位、成就与存档

先完整读取 `D:/rea_game/design/codex_m3_spec.md`、总体设计、`docs/M2-verification.md`、`docs/M3-contracts.md`，再读现有MetaProgression/storage和相关M2测试。仅修改本游戏。

你唯一拥有：新`src/config/ranks.ts`、`avatars.ts`、`src/core/PlayerProgression.ts`；现有`core/MetaProgression.ts`、`ui/storage.ts`；新`tests/m3-progression.test.ts`，旧`tests/ui.test.ts`仅扩展字段预期而不能削弱原测试。不得改types、maps、战斗、渲染、GameApp或翻译。

按固定契约实施54段位阈值/金币/敌血/碎片倍率、16头像成就、15位双语NPC榜单、永久地图解锁。Profile新字段由主代理写types；可在其落盘前先写测试。保留schemaVersion2；M1缺stars用合法wins初始化，M2有stars零不覆盖。highestStars用于掉段后地图保留。设置0合法，越界夹到0..1，非法数字补默认。

存档内一次性结算加星：胜+1，第三场及以后连胜+2；输断连胜，rank<10不掉，rank>=10最多掉到20。bestWinStreak单调。成就交易后及normalize立即评估，既有解锁不撤销。合成图鉴幂等。全满档stars至少180、全部头像与英雄图鉴，继续使用M2普通备份隔离机制。

先写回归观察失败再实现；覆盖54阈值、19/20星失利边界、3/5连胜、降级地图永久解锁、全部16条件、非法选择与设置、旧M1/M2档重复normalize、一次性结算、正常/失败存储下全满恢复保护。不改无关原回归。

报告写`docs/M3-progression-report.md`，记录文件、验证结果、接口差异和问题。跑定点、全套与typecheck；若其他模块未完成导致失败，逐项报告。不要启停服务器、派生代理或提交Git，最终回复只状态/测试摘要/报告路径。
