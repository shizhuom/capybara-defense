# P6 交付验证

本版本在 `D:\rea_game\games\capybara-defense\` 内实现，规格来源为只读的 `design/codex_p6_polish_settlement_hud_spec.md`。保留端口 `127.0.0.1:4175`、存档前缀 `capybara_defense_v1:`、P5 五步教学与原有养成/经济体系。

## 本次交付

- **193 张本地贴纸**：同步完整源 manifest 和 PNG；新增八枚结算/暂停/MVP/锁宠/号角/合成贴纸，HTML 与画布均有离线兜底。
- **暂停和胜负手账**：固定木纹题头、内部卷轴、固定底栏，战况速览、带武器图标的碎片、段位与星数、保星/连胜/升段、金币/扭蛋券、MVP 和解锁收藏。暂停保留恰好一个裸 `<section>` 的兼容契约。
- **真实 MVP**：独立 `CombatRecords` 按实际扣血统计，排除过量伤害和纯道具伤害；升星、配方合体、喂养及之后的持续伤害归属可继承，不向 `Unit` 塞入展示字段。
- **教程与浮层**：优先熊猫上场再叠斗笠，部署不跳步、窝内直接合成仍兼容；卡片、气泡、教学落点和提示按实际几何避让；竖屏提醒保持紧凑横条。
- **六页抛光**：神兵保留无障碍 select，但仅突出头像穿戴芯片；英语成长表不拆词、六书签完整；音量轨实时绿填充、去重语言栏；商店刷新嵌入遮阳篷，星数统一贴纸。
- **策略助手**：独立子随机源预生成首领排期，预告与真实主/副 Boss 一致；提前迎战按剩余时间奖粮；被动闪星区分英雄配方和升星/喂养；免费锁一格，换窝仅替换四格，离位/合成/回收后自动解锁。

新增主要模块：`core/CombatRecords.ts`、`ui/SettlementView.ts`、`ui/WaveStrategyView.ts`、`ui/p6.css`、`i18n/p6.ts`。其余能力接入既有引擎、渲染器、教学和实时属性卡。

## 自动验证

| 检查 | 结果与证据 |
| --- | --- |
| Vitest | **879 / 879**；包含原有 826 项及 53 项 P6 测试。[完整结果](../verification/p6-vitest-results.json) |
| 类型与生产构建 | `npm run build` 内含 `tsc --noEmit`，零错误；72 个模块完成打包 |
| 同步与隔离 | 193 张 PNG 和 manifest 与源字节一致；4 张地图均为 1280×720；2,376 个受保护文件无变化，父仓库 tracked diff 为空。[隔离报告](../verification/p6-isolation-report.json) |
| P6 浏览器 | 桌面 1280×720、横屏 844×390、竖屏 390×844；8 组闭环检查通过，Console/pageerror 为 0。[P6 报告](../verification/p6-browser-report.json) |
| 历史界面回归 | P5 五组、P4 六组、P3 十四组、手机字号/教学九组通过，Console/pageerror 均为 0。[P5](../verification/p5-browser-report.json) · [P4](../verification/p4-browser-report.json) · [P3](../verification/p3-browser-report.json) · [手机](../verification/p3-mobile-typography-report.json) |
| 正式构建 | 无开发调试 API；竖屏抽卡/图鉴/结算/重载正常；`/p6-check/game/` 下相对 JS/CSS/193PNG/音频清单全部可用。[生产报告](../verification/p6-production-report.json) |
| 普通/测试存档隔离 | 四种切换与写盘失败场景通过，旧战局不会污染恢复后的普通存档。[存档报告](../verification/p6-profile-switch-report.json) |
| 独立审查 | 核心逻辑无重大问题；发现的竖屏提醒问题经浏览器 RED→GREEN 修复。[审查和裁定](P6-review.md) |

浏览器测试采用独立临时配置，不操作用户实际浏览器存档。结算截图使用受控战斗夹具：调用真实引擎伤害记录、跳波和结算保存路径生成 MVP；没有直接伪造 `BattleResult`。全波次压力、延后副 Boss、首领排期和 RNG 不变性由逻辑测试验证。

## 主要截图

| 场景 | 桌面 | 手机横屏 |
| --- | --- | --- |
| 暂停手账 | [暂停](../verification/p6-desktop-pause.png) | [暂停](../verification/p6-mobile-landscape-pause.png) |
| 胜利与 MVP | [胜利](../verification/p6-desktop-victory.png) | [胜利](../verification/p6-mobile-landscape-victory.png) |
| 惜败卷轴 | [惜败](../verification/p6-desktop-defeat.png) | [惜败](../verification/p6-mobile-landscape-defeat.png) |
| 神兵头像配装 | [芯片](../verification/p6-desktop-armory-chips.png) | [芯片](../verification/p6-mobile-landscape-armory-chips.png) |
| 英文图鉴 | [六书签](../verification/p6-desktop-compendium-en.png) · [成长表](../verification/p6-desktop-compendium-growth.png) | [六书签](../verification/p6-mobile-landscape-compendium-en.png) · [成长表](../verification/p6-mobile-landscape-compendium-growth.png) |
| 设置 | [设置](../verification/p6-desktop-settings.png) | [单屏设置](../verification/p6-mobile-landscape-settings.png) |
| 商店 | [货架](../verification/p6-desktop-market.png) | [货架](../verification/p6-mobile-landscape-market.png) |
| 教学第 4 步 | [先上场](../verification/p6-desktop-tutorial4-deploy.png) · [叠斗笠](../verification/p6-desktop-tutorial4-merge.png) | [先上场](../verification/p6-mobile-landscape-tutorial4-deploy.png) · [气泡与卡片避让](../verification/p6-mobile-landscape-tutorial4-merge.png) |
| 预告/号角/锁宠/闪星 | [策略 HUD](../verification/p6-desktop-strategy-lock-hints.png) | [策略 HUD](../verification/p6-mobile-landscape-strategy-lock-hints.png) |

补充：[390×844 竖屏教学、属性卡和提示](../verification/p6-mobile-portrait-tutorial4.png) · [正式版竖屏](../verification/p6-production-mobile.png)。PNG 按现有 Git 规则留在本机 `verification/`，报告和复现脚本进入版本记录。

## 启动与版本

双击本目录 `Start-Capybara.cmd`，访问 <http://127.0.0.1:4175/>；`Stop-Capybara.cmd` 停止本作服务。已有页面请刷新。开发与正式服务不能同时占用 4175。

P6 保存在独立分支 `p6-settlement-strategy-polish`，交付标签为 `v1.0-p6`；P5 的 `v1.0-p5`（`326ab7e`）及更早标签继续保留，没有合并覆盖或推送远端。Git 只回退代码，浏览器存档需单独备份。
