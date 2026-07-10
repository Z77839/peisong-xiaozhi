# 🚀 配送小智 · 完整部署指南（GitHub Pages + Render + 真实数据接入）

> 总成本 **$0**，含前端 + 后端 + 4 个真实数据接入端口

## 📋 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│  用户浏览器                                                    │
│  https://Z77839.github.io/peisong-xiaozhi/                   │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
   ┌──────────────┐              ┌──────────────────┐
   │ GitHub Pages │   CORS+API   │ Render.com        │
   │ (前端静态)   │ ───────────→ │ (后端 Node.js)    │
   │ Vue3 SPA     │              │ peisong-backend   │
   │ 免费         │              │ 免费层            │
   └──────────────┘              └──────┬───────────┘
                                        │
        ┌───────────────────────────────┼──────────────────────────┐
        │                               │                          │
        ▼                               ▼                          ▼
  ┌──────────┐                  ┌──────────┐                ┌──────────┐
  │ 和风天气 │                  │ 饿了么   │                │ 骑手     │
  │ API      │                  │ Open API │                │ SDK WS   │
  │ 免费     │                  │ 需授权   │                │ 需集成   │
  └──────────┘                  └──────────┘                └──────────┘
```

## 🚀 一键部署步骤

### Step 1: 推送代码到 GitHub

```powershell
cd C:\Users\35090\Desktop\peisong-xiaozhi

# 第一次推送
git init
git add .
git commit -m "feat: 配送小智 v15 + 真实数据接入"
git remote add origin https://github.com/Z77839/peisong-xiaozhi.git
git push -u origin main
```

### Step 2: 部署前端到 GitHub Pages

1. 浏览器打开：https://github.com/Z77839/peisong-xiaozhi/settings/pages
2. **Source**: 选 **GitHub Actions**
3. 等 3-5 分钟，访问：https://Z77839.github.io/peisong-xiaozhi/

### Step 3: 部署后端到 Render（推荐）

1. 打开：https://render.com/
2. **Sign up with GitHub**（用 Z77839 账号登录）
3. 点 **New +** → **Web Service**
4. 选 `peisong-xiaozhi` 仓库
5. 配置：
   - **Name**: `peisong-xiaozhi-backend`
   - **Region**: Singapore
   - **Branch**: main
   - **Root Directory**: `backend`
   - **Build Command**: `npm install --legacy-peer-deps`
   - **Start Command**: `node src/server.js`
   - **Instance Type**: Free
6. 点 **Advanced** → 加环境变量（见下）
7. 点 **Create Web Service**

### Step 4: 配置环境变量（Render Dashboard）

在 Render Service 页面 → **Environment** → **Add Environment Variable**：

| Key | Value | 说明 |
|---|---|---|
| `NODE_ENV` | `production` | 必填 |
| `CORS_ORIGIN` | `*` | 允许所有来源（开发） |
| `QWEATHER_API_KEY` | `你的和风天气Key` | 推荐填（免费） |
| `COZE_BOT_ID` | `你的Bot ID` | 可选 |
| `COZE_API_KEY` | `你的Key` | 可选 |
| `ELEME_APP_KEY` | (待公司授权) | 可选 |
| `ELEME_ACCESS_TOKEN` | (待公司授权) | 可选 |
| `RIDER_WS_URL` | (待集成) | 可选 |
| `ORDER_STREAM_URL` | (待集成) | 可选 |

### Step 5: 拿到后端 URL

部署成功后，Render 会给你一个 URL：
```
https://peisong-xiaozhi-backend.onrender.com
```

### Step 6: 前端连接后端

编辑 `frontend/src/api/config.ts`：

```typescript
// 把这个改为你 Render 的 URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://peisong-xiaozhi-backend.onrender.com'
    : 'http://localhost:3000');
```

然后 `git add . && git commit -m "feat: 连接后端" && git push`，GitHub Pages 自动重新部署。

---

## 📊 4 个真实数据接入端口

### 1) 历史订单（饿了么 Open API）

**申请流程**：
1. 公司有饿了么/美团合作账号
2. 申请开发者资质：https://open.ele.me/
3. 创建应用获得 AppKey + AppSecret
4. OAuth 2.0 授权获取 AccessToken

**未授权时**：自动用 Mock 真实业务数据（90 天历史订单，衡阳/绍兴/常德/衢州各城市）

**调用**：
```bash
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/orders/historical?city=hengyang&days=90"
```

### 2) 骑手位置遥测（WebSocket）

**真实接入**：
- 骑手 App 集成定位 SDK
- App 后台启动 WebSocket 服务
- 推送格式：`{riderId, lat, lon, status, ts}`

**未接入时**：自动 Mock 真实业务数据（1200 骑手，5 种运力线分布）

**调用**：
```bash
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/riders/telemetry?city=hengyang"
```

### 3) 天气（和风天气 API）⭐ **推荐接入**

**申请流程**（10 分钟）：
1. 打开 https://dev.qweather.com/
2. 注册账号
3. 创建应用 → 选 **免费订阅**
4. 复制 API Key

**配置**：
- Render Dashboard → Environment → 加 `QWEATHER_API_KEY=你的key`

**调用**：
```bash
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/weather/forecast?city=hengyang"
```

**返回示例**：
```json
{
  "city": "hengyang",
  "source": "qweather",
  "current": { "temp": 22, "weather": "小雨", "humidity": 78 },
  "impact": { "factor": 1.3, "level": "warning" }
}
```

### 4) 订单池（WebSocket 实时）

**真实接入**：公司订单系统 → WebSocket 推送
**未接入时**：自动 Mock 真实业务数据（每 3 秒更新）

**调用**：
```bash
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/orders/pool?city=hengyang&range=1h"
```

---

## 🛠️ 验证部署

### 健康检查
```bash
# 后端
curl https://peisong-xiaozhi-backend.onrender.com/api/health

# 4 个数据接入端口
curl https://peisong-xiaozhi-backend.onrender.com/api/adapters/status
curl https://peisong-xiaozhi-backend.onrender.com/api/adapters/health
```

### 检查所有接口
```bash
# 天气
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/weather/forecast?city=hengyang"

# 骑手
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/riders/telemetry?city=hengyang"

# 订单池
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/orders/pool?city=hengyang&range=1h"

# 历史订单
curl "https://peisong-xiaozhi-backend.onrender.com/api/adapters/orders/historical?city=hengyang&days=7"

# 优化引擎
curl -X POST "https://peisong-xiaozhi-backend.onrender.com/api/optimize/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"cityId":"hengyang","orders":[],"riders":[]}'

curl -X POST "https://peisong-xiaozhi-backend.onrender.com/api/optimize/predict-gap" \
  -H "Content-Type: application/json" \
  -d '{"cityId":"hengyang","hour":18}'

curl -X POST "https://peisong-xiaozhi-backend.onrender.com/api/optimize/cost-plan" \
  -H "Content-Type: application/json" \
  -d '{"cityId":"hengyang","gap":800}'
```

---

## 🆓 免费额度

| 服务 | 免费额度 | 限制 |
|---|---|---|
| **GitHub Pages** | 100GB 流量/月 | 公开仓库 |
| **Render Web Service** | 750 小时/月 | 15 分钟无请求会休眠（冷启动 30s） |
| **和风天气** | 1000 次/天 | 个人开发者 |
| **饿了么 Open API** | 需公司授权 | 需 OAuth 2.0 |
| **数据库** | Render PostgreSQL 90 天 | 然后需付费或迁移 |

**注意事项**：
- Render 免费层 15 分钟无请求会休眠，下次访问需 30s 冷启动
- 生产环境建议升级到 $7/月 避免休眠

---

## 📁 部署后端到其他平台

### Vercel（备选）
```bash
cd backend
npm i -g vercel
vercel --prod
```

### Railway（备选）
1. 打开 https://railway.app/
2. Sign in with GitHub
3. New Project → Deploy from GitHub → 选 `peisong-xiaozhi/backend`
4. 自动部署

### Fly.io（备选）
```bash
cd backend
curl -L https://fly.io/install.sh | sh
fly launch
fly deploy
```

---

## 🎯 部署完成标志

- ✅ `https://Z77839.github.io/peisong-xiaozhi/` 能访问
- ✅ `https://peisong-xiaozhi-backend.onrender.com/api/health` 返回 200
- ✅ `/api/adapters/status` 显示 4 个数据端口
- ✅ `/api/adapters/weather/forecast?city=hengyang` 返回真实天气（或 Mock）

---

## 🆘 常见问题

### Q: Render 后端部署失败？
A: 看 Render Logs。常见原因：
- `npm install` 失败：检查 `backend/package.json` 依赖
- 端口冲突：确认 `PORT=3000` 环境变量
- CORS 错误：`CORS_ORIGIN=*`

### Q: 前端连不上后端？
A: 检查：
1. 后端 URL 是否正确（带 https://）
2. CORS 是否放开（`*` 或具体域名）
3. 浏览器 Network 标签看实际请求

### Q: Render 免费层 15 分钟休眠？
A: 升级到 $7/月，或用 cron-job.org 定时 ping 保持活跃：
```bash
curl https://cron-job.org/en/
# 配置每 10 分钟 ping 一次后端
```

### Q: 饿了么 Open API 怎么申请？
A:
1. 公司登录 https://open.ele.me/
2. 创建应用 → 提交资质
3. 审核通过后拿到 AppKey + AppSecret
4. OAuth 2.0 流程获取 AccessToken
5. 配置到 Render 环境变量

---

## 📞 支持

部署卡住了？把以下任一信息发给我：
- Render 部署日志
- 浏览器 Network 报错
- `/api/adapters/status` 的返回结果

我立刻帮你排错！🚀
