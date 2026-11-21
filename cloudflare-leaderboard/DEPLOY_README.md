# 无尽全球榜 · Cloudflare 3 分钟部署指南

这个目录是《卡皮巴拉别慌！》**无尽全球榜**的后端：一个零依赖的 Cloudflare Worker 加一个 D1（SQLite）数据库。
它跑在 Cloudflare 的免费额度内（Workers 每天 10 万次请求，D1 每天 500 万行读取），**$0/月、不休眠、玩家无需注册**。

游戏前端在没有配置后端地址时会自动进入「本机模式」，所以**不部署也完全能玩**；部署后，全球榜才会显示真实玩家。

---

## 0. 准备

- 一个 Cloudflare 账号（免费版即可）：<https://dash.cloudflare.com/sign-up>
- Node.js 22 或更新版本

## 1. 安装依赖

```bash
cd cloudflare-leaderboard
npm install
```

## 2. 登录 Cloudflare

```bash
npx wrangler login
```

浏览器会弹出授权页面，点「允许」即可。

## 3. 创建 D1 数据库

```bash
npx wrangler d1 create capybara-endless-db
```

命令会输出一段配置，其中有一行：

```toml
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 4. 填入 `database_id`

打开 `wrangler.toml`，把 `REPLACE_WITH_YOUR_D1_ID` 换成上一步得到的 ID。

如果你的游戏不是部署在 `https://shizhuom.github.io`，顺便改一下 `[vars]` 里的 `ALLOWED_ORIGINS`（逗号分隔，只写协议 + 域名 + 端口，不带路径）。只有名单里的网站能跨域读写排行榜。

## 5. 建表

```bash
npm run db:init:remote
```

（本地调试可用 `npm run db:init:local` 加 `npm run dev`。）

## 6. 部署

```bash
npm run deploy
```

成功后会打印 Worker 地址，形如：

```
https://capybara-endless-leaderboard.<你的子域>.workers.dev
```

先用浏览器或 curl 检查一下：

```bash
curl https://capybara-endless-leaderboard.<你的子域>.workers.dev/api/health
# {"ok":true,"service":"capybara-endless-leaderboard"}
```

## 7. 接入游戏

在**游戏根目录**（`capybara-defense/`，不是本目录）新建 `.env.production`：

```bash
VITE_LEADERBOARD_API_URL=https://capybara-endless-leaderboard.<你的子域>.workers.dev
```

然后重新构建并推送静态站：

```bash
npm run build
```

打开游戏 → 段位 → 「无尽全球榜」，顶部不再显示离线提示即接入成功。打一局无尽，结算画面会出现 `🌍 全球第 #N 名`。

---

## 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/leaderboard?playerId=<id>&limit=100` | 全球 Top `limit`（最多 100）、总人数、本人精确名次 |
| `POST` | `/api/score` | 提交 / 刷新最佳无尽成绩，或只更新昵称与头像 |

排序规则：**波次高者在前 → 同波次用时短者在前 → 同成绩先达成者在前**。

`POST /api/score` 请求体（JSON）：

```json
{ "playerId": "capy_ab12cd34ef56", "nickname": "泡汤水豚", "avatarId": "capybara",
  "bestWave": 48, "elapsedSeconds": 2310, "mvpKind": "kungfu_po", "mvpAwakened": true,
  "awakenedCount": 2, "medallionTotal": 64 }
```

## 安全与防刷

- **CORS 白名单**：只有 `ALLOWED_ORIGINS` 中的网站能跨域调用；其他来源的预检与写入返回 `403`。
- **IP 限流**：每个 IP 每分钟最多 20 次写入，超出返回 `429`。数据库只保存 IP 的加盐哈希前缀，不保存原始 IP。
- **范围校验**：`playerId` 为 8–64 位字母数字/下划线/连字符；昵称去除控制字符与尖括号后 2–14 字，并通过阳光健康词过滤；`bestWave` 必须在 11–120 之间；用时不少于 `max(60, (波次 − 10) × 6)` 秒且不超过 24 小时；勋章总等级 0–300，觉醒英雄 0–12。
- **合理战力**：第 45 波及以上需要勋章总等级 ≥ 30 或至少 1 名觉醒英雄。
- **只升不降**：更低的成绩不会覆盖历史最高波次，只会同步新的昵称与头像。

## 常见问题

- **榜单一直显示离线？** 检查 `.env.production` 的地址是否以 `https://` 开头、没有结尾斜杠，以及 `ALLOWED_ORIGINS` 是否包含你的游戏域名。
- **想清空排行榜？** `npx wrangler d1 execute capybara-endless-db --remote --command "DELETE FROM endless_scores"`。
- **免费额度够吗？** 每位玩家每局只提交一次成绩、打开榜单最多每 30 秒读一次，个人项目远远用不完。
