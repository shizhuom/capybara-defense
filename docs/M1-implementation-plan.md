# 卡皮巴拉别慌！M1 实施计划

> 按 writing-plans、executing-plans 与 dispatching-parallel-agents 工作流执行；用户已指定唯一设计来源和完整实现授权，不再另起设计审批。

目标：完成可独立运行、可测试的双人镜像抗压夺宝 M1。

权威需求：../../../design/pet_defense_design.md 与 ../../../design/codex_m1_spec.md，已完整阅读。仅本目录可写；不提交或改动根仓库配置。

技术：TypeScript、Vite、Canvas 2D、Vitest。纯数据与无头仿真是稳定接口，渲染及双语界面独立消费状态。

## 执行顺序

- [x] 记录保护文件摘要；建立独立工程与配置/类型契约。
- [x] 先写核心行为测试，验证失败；实现网格、合成、喂养、交换、解控与经济。
- [x] 实现真实战斗、12 位英雄普攻/大招、六首领、10 波、AI 与通吃结算；补充行为测试。
- [x] 并行实现程序化贴纸渲染及图片替换接口、双语 UI 与全部测试台操作。
- [x] 集成启动/停止服务、存档、输入；通过类型检查、Vitest、构建与浏览器操作检查。
- [x] 独立审查修复；核对保护文件摘要及 Git 状态；交付中文运行说明。

## 接口与文件

src/core/types.ts 定义 Side、Unit、Enemy、BattleState、UnitLocation、VisualEvent、Profile、结果与命令。
src/config/ 定义 19 张抽卡、12 配方/英雄、普通敌人/6 首领、最终精确矩阵/16 航点（15 段）、10 波。
GridSystem 管网格与路径；MergeSystem 负责纯操作；BattleEngine 暴露 state、tick、start、pause、summon、grant、move、dig、spawnBoss、adjustOranges、skipWave、surrender；OpponentAI 仅调用同一套合法操作。
StickerRenderer.draw(state, seconds, interaction)；AssetRegistry 按 id 寻找 public/sprites 图片，无图片回退矢量。
UI 使用真实引擎状态，语言变化重绘文案但不重建对局。localStorage 仅 capybara_defense_v1: 前缀。

## 已确定的细节

- 工程规范覆盖设定总纲中的粗略数字：抽卡 76%/24%，蜜蜂最高 3 级且产量按 M1 表。
- 地图采用最后一份标准矩阵及明确坐标数组；15 指路径段数，数组实际有 16 个节点。
- 英雄大招升级减冷却通过所需充能乘 0.9^(等级-1) 实现；其它未规定的基础面板、敌人血速与波次数量集中在配置表，便于后续调平衡。
- 第 10 波清场后双方尚有生命时，依次比较橘子、击杀数、累计伤害；完全平局玩家胜。此为规范未给定的确定性收局规则。
- M1 仅实现文档指定的核心战斗；武器锻造/商店/完整道具属于 M2，不以空壳按钮冒充完成。

## 审查重点

封印单位仍可拖拽升级；剪刀禁合不能被绕过。跨半区部署与交换拒绝且不能吞卡。窝满不扣费。暂停期间逻辑与 AI 冻结，语言切换保持对局。首领越线扣 2 橘子且结算只发奖一次。停止脚本只操作本项目的 4175 服务。
