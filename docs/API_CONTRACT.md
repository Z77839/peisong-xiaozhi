# 配送小智 · API 契约

> 最后更新：fix/deploy-and-api 分支  
> Base URL：开发 `http://localhost:3000` / 生产 `https://peisong-backend.onrender.com`  
> 全部接口前缀 `/api`

## 0. 通用约定

### 响应结构

```json
{
  "code": 0,
  "data": {},
  "message": "success"
}
```

| code | 含义 |
| --- | --- |
| 0 / 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未登录 / token 失效 |
| 403 | 无权限 / 账号停用 |
| 404 | 接口不存在 |
| 429 | 限流 |
| 500+ | 服务异常 |

### 鉴权

请求头加 `Authorization: Bearer <token>`，`token` 从 `POST /api/auth/login` 拿。

### 限流

- 全局：`RATE_LIMIT_PER_MINUTE=300`/分钟（`/api/health` 跳过）
- 登录：`/api/auth/login` 15 分钟最多 10 次，失败 5 次锁定账号 15 分钟

### 健康检查

`GET /api/health` 返回 `version`、`uptime`、`env`、当前时间戳。

---

## 1. 鉴权 & 用户

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | ❌ | body: `{ account, password }` |
| GET | `/api/auth/me` | ✅ | 当前 token 解析 |
| POST | `/api/auth/change-password` | ✅ | body: `{ oldPassword, newPassword }` |
| GET | `/api/auth/demo-users` | ❌ | 返回后端默认演示账号清单（仅当 `NODE_ENV!==production`） |

**演示账号**（后端 `db.js#initDefaultUsers`，前端登录页快捷填充同步）：

| account | password |
| --- | --- |
| admin | admin@2024 |
| operator | operator@2024 |
| analyst | analyst@2024 |

---

## 2. 运营总览 / Dashboard

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/dashboard` | ❌ | 完整 Dashboard 数据（衡阳 + 4 城市） |
| GET | `/api/dashboard/capabilities` | ❌ | AI 能力清单 |

> ⚠️ Dashboard 卡片中"94.2% 准确率 / 成本下降 18%"等数字是 `dispatch.js` / `dashboard.js` 内置常量，**不是真实模型结果**。前端在卡片右下角会显示"演示值"角标。

---

## 3. 决策中心（核心闭环）

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/decision/run` | ❌ | 决策生成。body: `{ query, cityId, override? }` |
| GET | `/api/decision/history` | ❌ | 历史列表（含 feedback） |
| GET | `/api/decision/:id` | ❌ | 单条详情 |
| POST | `/api/decision/feedback` | ❌ | 派单/告警回写。body: `{ decisionId, dispatchId?, alertId?, result, message?, riderCount? }` |

**决策 ID 规则**（重要）：

- `runDecisionWorkflow()` 生成 `decisionId` 形如 `d_<timestamp>_<rand>`
- `saveDecision` 复用同一个 ID 入库（不再覆盖）
- 派单 / 告警 / 反馈 / 详情回跳 全链路共享这一个 ID

---

## 4. 智能派单

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/dispatch?cityId=` | ❌ | 订单池 + 骑手池 + 推荐 |
| POST | `/api/dispatch/execute` | ❌ | body: `{ orderId, riderId, decisionId? }`；若带 `decisionId` 自动回写 feedback |
| POST | `/api/dispatch/batch` | ❌ | 批量派单 |

---

## 5. 预警中心

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/alert?cityId=` | ❌ | 主动预警列表（按 city 过滤） |
| POST | `/api/alert/ack/:id` | ❌ | 确认告警 |
| POST | `/api/alert/action` | ❌ | 触发对应建议动作 |

---

## 6. 骑手 / 运力

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/riders` | ✅ | 分页列表（27,186 真实骑手） |
| GET | `/api/riders/stats` | ✅ | 多维统计 |
| GET | `/api/riders/health` | ❌ | 数据源健康度 |
| GET | `/api/riders/capacity` | ❌ | 4 城市运力缺口（决策中心联动） |
| GET | `/api/riders/segments` | ❌ | 5 运力线分组 |
| GET | `/api/riders/lifecycles` | ❌ | 骑手生命周期 |
| GET | `/api/riders/stations` | ❌ | 头部站点 |
| GET | `/api/riders/:id` | ✅ | 单条详情 |
| POST | `/api/riders/import` | ✅ | 导入 CSV |
| POST | `/api/riders/add` | ✅ | 手动新增 |
| GET | `/api/riders/extra` | ✅ | 手动新增列表 |
| GET | `/api/riders/import-stats` | ✅ | 导入统计 |
| DELETE | `/api/riders/extra/:id` | ✅ | 删手动新增 |

---

## 7. 优化引擎

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/optimize/dispatch` | ❌ | MILP 派单 |
| POST | `/api/optimize/predict-gap` | ❌ | 缺口预测 |
| POST | `/api/optimize/cost-plan` | ❌ | 成本规划 |
| GET | `/api/optimize/predict-gap` | ❌ | GET 版（仅查询） |
| GET | `/api/optimize/cost-plan` | ❌ | GET 版 |
| GET | `/api/optimize/models` | ❌ | 当前可用模型 |
| GET | `/api/optimize/adapters/status` | ❌ | 4 端口状态 |

---

## 8. LLM / Chat

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/llm/status` | ❌ | 4 个 LLM 启用状态 |
| POST | `/api/llm/chat` | ✅ | 单次对话 |
| POST | `/api/llm/agents/:agentId` | ✅ | 调指定 agent |
| POST | `/api/chat` | ❌ | 配送小智对话 |
| GET | `/api/chat/history` | ❌ | 历史会话 |
| GET | `/api/chat/history/:id` | ❌ | 单会话详情 |

---

## 9. 城市 / 上下文 / 适配器

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/cities` | ❌ | 4 城市清单 |
| GET | `/api/cities/total` | ❌ | 汇总 |
| GET | `/api/cities/vision` | ❌ | 战略视角 |
| GET | `/api/cities/:id` | ❌ | 单城详情 |
| GET | `/api/context?cityId=&hour=&weather=` | ❌ | 智能体感知上下文 |
| GET | `/api/context/weather/test` | ❌ | 天气接口联通测试 |
| GET | `/api/adapters/status` | ❌ | 4 端口状态 |
| GET | `/api/adapters/orders/historical` | ❌ | 历史订单（饿了么 mock） |
| GET | `/api/adapters/riders/telemetry` | ❌ | 骑手实时位置（mock） |
| GET | `/api/adapters/weather/forecast` | ❌ | 天气预报（和风 mock） |
| GET | `/api/adapters/orders/pool` | ❌ | 订单流（mock） |
| GET | `/api/adapters/health` | ❌ | 端口健康 |

---

## 10. 仿真 / 知识库 / 其它

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/simulation/state` | ❌ | 仿真状态 |
| POST | `/api/simulation/control` | ❌ | start/pause/reset |
| GET | `/api/simulation/timeline` | ❌ | 时间线 |
| GET | `/api/knowledge/list` | ✅ | 知识库列表 |
| POST | `/api/knowledge/upload` | ✅ | 上传文件 |
| DELETE | `/api/knowledge/:id` | ✅ | 删 |
| GET | `/api/knowledge/search` | ✅ | 搜索 |
| GET | `/api/knowledge/stats` | ✅ | 统计 |
| POST | `/api/knowledge/seed` | ✅ | 重置 demo 知识 |
| GET | `/api/ai-insights` | ❌ | AI 洞察 |
| GET | `/api/c-end/community` | ❌ | C 端社群 |
| GET | `/api/c-end/group` | ❌ | 拼单 |
| GET | `/api/c-end/levels` | ❌ | 拼单等级 |
| GET | `/api/c-end/trend` | ❌ | 趋势 |
| GET | `/api/rider-types` | ❌ | 骑手类型 |
| GET | `/api/admin/backup` | ❌ | 手动触发 GitHub 备份 |
| GET | `/api/debug/env-check` | ❌ | 环境变量脱敏回显（仅 dev） |

---

## 11. 与前端调用对齐说明

- 前端 `src/api/index.ts` 中 `orderApi.predict/list`、`costApi.analyze/breakdown`、`merchantApi.health`、`reportApi.generate` 等接口**后端无对应路由** → 已用注释保留为 Mock 模式入口（实际调用会被 404 拦截）→ 后续可补 `/api/order/*` `/api/cost/*` 等路由
- 前端 `runMultiAgentWorkflow` 调 `/api/decision/run`（路径一致 ✅）
- 前端 dispatch 调 `/api/riders/capacity`、`/api/dispatch/execute`、`/api/decision/feedback`（路径一致 ✅）
- 前端 alert 调 `/api/alert`（路径一致 ✅）

## 12. 不再保留的接口

- `POST /api/admin/backup` 的真实路径见上文，**GET / POST 都支持**
- `GET /api/auth/demo-users` **仅 `NODE_ENV !== 'production'` 暴露**，生产环境返回 404

---

## 附：与产品页面对照表（用于答辩 / 演示）

| 前端页面 | 调用的后端接口 | 数据真实度 |
| --- | --- | --- |
| 运营总览 `/dashboard` | `/api/dashboard` | 真实（来自 `data/cities.js` + `ridersDataService`） |
| 决策中心 `/decision` | `/api/decision/run` | 真 LLM（未配 LLM Key 时降级 mock） |
| 决策历史 | `/api/decision/history` | 真实（decisions.json + GitHub 备份） |
| 预警中心 `/alert` | `/api/alert` | 真实（基于真实订单 / 骑手数据推算） |
| 智能派单 `/dispatch` | `/api/dispatch` + `/api/optimize/dispatch` | 真实（MILP 引擎） |
| 骑手管理 `/rider` | `/api/riders/*` | 真实（27,186 行 CSV） |
| 订单分析 `/order` | `/api/adapters/orders/*` | 真实接口 + mock 数据 |
| 成本分析 `/cost` | `/api/optimize/cost-plan` | 真实 |
| 知识库 `/knowledge` | `/api/knowledge/*` | 真实上传 |
| 数据接入 `/data-source` | `/api/adapters/status` | 真实（4 端口联通状态） |
| 系统设置 `/setting` | `/api/auth/change-password` | 真实 |
