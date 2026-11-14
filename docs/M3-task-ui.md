# Task 4：v1.0界面、双语与浏览器闭环

先完整读只读M3规范、总体设计、M2验收、`docs/M3-contracts.md`与当前GameApp/MetaScreens/styles/i18n后再编码。仅修改本工程。

你唯一拥有：`src/ui/GameApp.ts`、`MetaScreens.ts`、新`ProfileScreens.ts`、新`m3.css`（可微调m2.css/styles.css）；`src/i18n/m3.ts`、`i18n.ts`；`tests/m3-i18n.test.ts`、`scripts/m3-browser-qa.mjs`。不可改core/types/config/storage/render/SoundManager或旧测试。不可启停服务、派生代理、提交Git。

菜单醒目rank/星进度/当前头像，auto及已解锁地图选择。顶栏设置，品牌点击名片（战斗时暂停并可回到原暂停状态）；名片显示16手绘头像、透明条件和解锁，风云榜显示15NPC+自己即时排名、段位/头像/胜率。所有交易保存成功再更新内存，测试档继续原backup保护。

开局传mapId=resolveMap(profile)、rankIndex=getRank(profile.stars).index；设置滑块与飘字即时保存/生效。引擎合成图鉴用recordMergedHeroes即时记录，结算仍幂等；显示胜负升星/保护、晋级、新头像提示。接入SoundManager按契约，用户手势unlock，后台/暂停duck，实际召唤/铲地/合体/结算与扭蛋音效不重复。

衣帽间每武器专属SVG，顶部12英雄当前配装概览和橙品优先/默认排序。后院测试台rank0..53和4图选择、12Boss；一键全满M3。修复320/390封印横幅与绿色胶囊压边，所有新增区域适应窄屏。旧M1/M2 data-action/DOM语义保持；视图改变不能重领/重置战斗。

双语所有配置和提示含新boss/衍生物；先写完整键/占位符失败回归后实现。浏览器QA脚本覆盖4地图实战路径、头像/榜单、衣帽间概览排序、设置即时持久化/音效安全、晋级/新头像、旧档保值与全满恢复；桌面320/390截屏。先写脚本，待主代理通知源码冻结且dev4175就绪后运行，不能自行换服务。报告写`docs/M3-ui-report.md`；只回复状态/测试摘要/报告路径。
