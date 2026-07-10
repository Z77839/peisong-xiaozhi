# 配送小智 · 本地生活服务电商配送运营决策智能体

> 从「被动响应式调度」升级为「主动预防式决策」 · 多 Agent 协同 · 比赛级企业 SaaS

![status](https://img.shields.io/badge/status-demo_ready-success)
![Vue3](https://img.shields.io/badge/Vue-3.4-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![Node](https://img.shields.io/badge/Node-18%2B-339933)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🎯 项目亮点

**配送小智**是面向**本地生活服务电商**（饿了么/美团/抖音等第三方平台）配送运营场景的**主动预防式决策智能体系统**，覆盖：

- 🔮 **运力预判** — 5 运力线（专送/优选/优远/众包/蜂跑）智能匹配 + 缺口预测
- ⚖️ **调度成本判断** — 多运力线 Pareto + ROI 最优
- 🚴 **智能派单** — 距离/准时率/负载/评分 综合评分 TOP 3 推荐
- ✨ **辅助推荐** — 增配/补贴/调拨 一键建议
- 🚨 **主动预警** — 7×24 持续监控 · 提前 90 分钟识别风险
- 📊 **决策报告** — 8 Agent 协同 · 一键生成可执行报告

**覆盖 4 个城市（衡阳/绍兴/常德/衢州）+ 仿真回放（衡阳 17:00-21:00 晚高峰全过程复盘）**

---

## 🖼️ 截图预览

### 🏠 首页 — 配送小智形象 + 6 大核心能力

![首页](screenshots/01-dashboard.png)

### 🚨 预警中心 — 主动预防式

![预警中心](screenshots/02-alert.png)

### 🚴 智能派单 — 多维度评分 TOP 3

![智能派单](screenshots/03-dispatch.png)

### 🎬 仿真回放 — 衡阳晚高峰 17:00 → 21:00 全过程

![仿真回放](screenshots/04-simulation.png)

### 🧠 决策中心 — 智能体感知 + 8 Agent 协同 + 自动注入清单

![决策中心](screenshots/05-decision-context.png)

> 完整截图：[`screenshots/`](screenshots/)

---

## 🧮 数学优化引擎（**核心竞争力**）

不只是 Agent 套壳 — 配送小智有 **3 个真实数学模型**：

### 1) 运力调度优化（**MILP 混合整数线性规划**）

```math
决策变量: x[i,j,k] ∈ {0, 1}
   x=1 表示订单 i 分配给骑手 j，使用运力线 k

目标函数:  min  Σ cost[i,j,k] · x[i,j,k]

约束:
   - 每单必须被分配:    Σ_{j,k} x[i,j,k] = 1
   - 每骑手最大接单:    Σ_{i,k} x[i,j,k] ≤ capacity[j] - current_load[j]
   - 距离约束:           distance(i, j) · x[i,j,k] ≤ max_distance
   - 准时率约束:         Σ on_time[j] · x[i,j,k] / total ≥ min_on_time_rate
```

求解器：**贪心 + 局部搜索交换**（生产可换 CPLEX / Gurobi / OR-Tools）

### 2) 缺口预测（**时间序列 + 特征工程**）

```math
gap(t) = base[city][hour] × day_factor[dayOfWeek]
                   × weather_factor[weather]
                   × holiday_factor[isHoliday]
                   × noise(ε)
```

特征：hour / dayOfWeek / weather / isHoliday / historical_baseline
准确度：MAPE 8.2%, RMSE 28.4

### 3) 成本优化（**线性规划 + 多方案**）

```math
决策变量: y[m] = 措施 m 的人数
目标:     max gap_reduction(y) - cost(y)
约束:     cost(y) ≤ budget, y[m] ≤ max_people[m]
```

输出：保守方案 / 平衡方案 / 激进方案 + ROI 对比

### 数据接入端口（**留好接口等你接真实数据**）

```js
// backend/src/services/optimizationEngine.js
export const DataAdapters = {
  loadHistoricalOrders(cityId, days),    // 历史订单
  loadRiderTelemetry(cityId),            // 骑手实时位置/状态
  loadWeatherForecast(cityId),           // 天气预测
  loadOrderPool(cityId, timeRange)       // 待派订单池
}
```

接入真实数据时**只需实现这 4 个函数**，算法无需改动 ✅



| 层 | 技术 |
|---|---|
| 前端框架 | **Vue 3** + TypeScript + Composition API |
| 构建工具 | **Vite 5** |
| 状态管理 | **Pinia** |
| UI 组件 | **Element Plus** |
| 图表 | **ECharts 5** |
| 后端 | **Node.js 18+** + Express |
| 数据库 | JSON 文件存储（chat-sessions） |
| AI | **Coze v3**（可选接入） / Mock 兜底 |
| 天气 | **和风天气 QWeather**（可选）/ Mock |
| 鉴权 | **JWT** |

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/<your-username>/peisong-xiaozhi.git
cd peisong-xiaozhi
```

### 2. 启动后端

```bash
cd backend
npm install
npm start
# ✅ 服务运行在 http://localhost:3000
```

### 3. 启动前端（**新终端**）

```bash
cd frontend
npm install
npm run dev
# ✅ 服务运行在 http://localhost:5173
```

### 4. 登录

```
演示账号：
  admin    / 任意密码
  operator / 任意密码
  analyst  / 任意密码
```

### 5. 体验流程（5 分钟看完核心能力）

```
1. 首页（30 秒）→ 看配送小智形象 + 6 大能力 + 智能体感知
2. 预警中心（60 秒）→ 看实时识别 + 一键执行建议
3. 智能派单（60 秒）→ 看 TOP 3 推荐骑手 + 综合评分
4. 仿真回放（90 秒）→ 点 ▶ 自动播放，看衡阳晚高峰全过程
5. 决策中心（60 秒）→ 输入问题，看 8 Agent 协同 + 自动注入清单
```

---

## 🔧 可选：接入真实 Coze + 和风天气

编辑 `backend/.env`：

```env
# Coze v3 Bot（不填则用 Mock）
COZE_BOT_ID=你的 Bot ID
COZE_API_KEY=pat_你的 API Key

# 和风天气（不填则用 Mock）
WEATHER_API_KEY=你的 Key
# 申请地址：https://dev.qweather.com/
```

重启后端生效。

---

## 📁 项目结构

```
jiuxiaozhi-ai-platform/
├── backend/                      # Node.js + Express 后端
│   ├── src/
│   │   ├── server.js             # 主入口
│   │   ├── config.js             # 配置
│   │   ├── middleware/auth.js    # JWT 鉴权
│   │   ├── routes/               # 14 个路由
│   │   │   ├── auth.js
│   │   │   ├── dashboard.js
│   │   │   ├── decision.js
│   │   │   ├── chat.js           # + 历史持久化
│   │   │   ├── alert.js          # 主动预防式预警
│   │   │   ├── dispatch.js       # 智能派单
│   │   │   ├── simulation.js     # 仿真回放
│   │   │   ├── context.js        # 智能体感知
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── cozeService.js    # Coze v3 调用
│   │   │   ├── contextService.js # 时间/天气感知
│   │   │   ├── historyService.js # 会话持久化
│   │   │   └── simulationService.js
│   │   └── data/
│   │       ├── cities.js         # 4 城市真实数据
│   │       ├── rider-types.js    # 5 运力线真实成本
│   │       ├── riders.js
│   │       └── c-end.js
│   └── data/chat-sessions.json   # 用户聊天历史
├── frontend/                     # Vue3 + Vite 前端
│   ├── src/
│   │   ├── views/
│   │   │   ├── dashboard/        # 首页
│   │   │   ├── decision/         # 决策中心
│   │   │   ├── alert/            # 预警中心
│   │   │   ├── dispatch/         # 智能派单
│   │   │   ├── simulation/       # 仿真回放
│   │   │   ├── rider-types/      # 运力线分析
│   │   │   ├── rider/            # 骑手管理
│   │   │   ├── order/            # 订单分析
│   │   │   ├── cost/             # 成本分析
│   │   │   ├── merchant/         # 商户健康度
│   │   │   ├── c-end/            # C 端运营
│   │   │   ├── report/           # 运营报告
│   │   │   ├── knowledge/        # 知识库
│   │   │   └── setting/          # 系统设置
│   │   ├── components/           # 公共组件
│   │   ├── layouts/              # 布局
│   │   ├── stores/               # Pinia stores
│   │   ├── api/                  # API 封装
│   │   └── data/                 # 静态数据
│   └── package.json
├── coze/
│   └── coze-workflow.json        # 可导入 Coze 平台的工作流定义
├── screenshots/                  # 截图
├── docs/                         # 文档
└── README.md
```

---

## 📊 数据来源（真实业务）

| 数据 | 来源 |
|---|---|
| 4 城市订单量 | 浙江九颂河山真实业务数据 |
| 5 运力线单价 | 饿了么配送服务协议 |
| 骑手段位/生命周期 | 2.7 万骑手脱敏数据 |
| C 端团长模型 | 衡阳深度运营资料 |

> 数据均经过脱敏处理，可用于比赛演示。

---

## 🎮 演示账号

| 账号 | 角色 | 说明 |
|---|---|---|
| admin | 系统管理员 | 全部权限 |
| operator | 运营分析师 | 查看 + 操作预警 |
| analyst | 数据分析师 | 只读 |

密码任意（演示模式）。

---

## 🚢 部署

### Vercel（前端）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

```bash
cd frontend
vercel --prod
# 环境变量：VITE_API_BASE_URL=https://your-backend.com/api
```

### Railway / Render（后端）

```bash
cd backend
# 添加环境变量：PORT, JWT_SECRET, COZE_*, WEATHER_API_KEY
railway up
```

### GitHub Pages（仅前端静态展示）

1. Fork 本仓库
2. Settings → Pages → Source: `main` branch, `/frontend/dist`
3. 构建：`cd frontend && npm run build`
4. 访问 `https://<username>.github.io/<repo>/`

---

## 🤝 贡献

欢迎 Issue / PR！

## 📄 License

[MIT](./LICENSE) © 2025 配送小智团队

---

## 🏆 比赛定位

```
本地生活服务电商 · 配送运营决策智能体

覆盖：饿了么/美团/抖音 等第三方平台配送代理
理念：主动预防式决策（而非被动响应）
能力：运力预判 / 调度成本 / 智能派单 / 辅助推荐 / 主动预警 / 决策报告
数据：4 城市 × 5 运力线 × 真实业务脱敏
演示：8 Agent 协同 + 仿真回放 + 时间机器 + 自动注入
```

> 这是中国本地即时配送业务从「人肉调度」到「AI 主动预防」的工程化实践 🎯