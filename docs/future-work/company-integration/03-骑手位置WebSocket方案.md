# 骑手位置 WebSocket 对接方案

> **目标**：从公司骑手 App 实时获取骑手位置 + 状态
> **对接方**：公司 App 开发团队
> **预计周期**：2-4 周
> **预算**：0（内部资源）

## 📧 协调邮件（给公司 App 团队负责人）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
收件人：[App 团队负责人] / 抄送：技术总监
主题：配送小智 - 骑手位置 WebSocket 推送需求
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[负责人姓名] 您好：

「配送小智」AI 决策系统需要从骑手 App 实时获取骑手位置和状态，
用于实时派单、异常监控、骑手热力图等功能。

具体技术需求：

1. 推送方式：WebSocket（推荐）或 HTTP POST
2. 推送频率：每 10 秒 / 骑手
3. 推送字段：骑手 ID、经纬度、当前订单、状态、电量
4. 并发量：约 1200 骑手 × 0.1 Hz = 120 msg/s
5. 鉴权方式：Bearer Token

预计对接工作量：2-4 周
对接文档：见附件《骑手位置 WebSocket 推送规范》

需要 App 团队支持：
□ 提供 WebSocket 端点 URL
□ 提供鉴权 Token
□ 推送字段格式对接
□ 联调测试

期待您的回复！

[我的名字]
日期：2026-07-XX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔧 WebSocket 推送规范

### 端点格式

```
wss://app-rider-ws.公司域名.com/v1/riders/live
```

### 鉴权

**方式 1：URL 参数**
```
wss://app-rider-ws.公司域名.com/v1/riders/live?token=<bearer_token>
```

**方式 2：Header（推荐）**
```javascript
new WebSocket(url, {
  headers: {
    'Authorization': 'Bearer <token>'
  }
})
```

### 推送消息格式

**单条推送**（每 10 秒）：
```json
{
  "type": "rider_position",
  "ts": 1688000000000,
  "data": {
    "riderId": "R001",
    "riderName": "张明远",
    "lng": 112.57,
    "lat": 26.89,
    "status": "delivering",        // idle | delivering | rest | offline
    "currentOrderId": "O12345",
    "batteryLevel": 78,
    "cityId": "hengyang"
  }
}
```

**批量推送**（推荐，更高效）：
```json
{
  "type": "rider_positions_batch",
  "ts": 1688000000000,
  "data": [
    { "riderId": "R001", "lng": 112.57, "lat": 26.89, "status": "delivering" },
    { "riderId": "R002", "lng": 112.58, "lat": 26.90, "status": "idle" },
    ... // 100-500 条/批
  ]
}
```

## 🔌 我们后端实现

**文件位置**：`backend/src/adapters/riderTelemetryAdapter.js`

**已实现的接口**：
```javascript
// 加载骑手位置（轮询模式）
export async function loadRiderTelemetry(cityId) {
  // 如果配了 RIDER_WS_URL，用 WebSocket
  // 否则用 Mock 模拟器
}

// Mock 模拟器（1200 骑手，10 秒更新）
function startRiderSimulator() {
  setInterval(() => {
    // 模拟骑手位置变化
  }, 10000)
}
```

**App 团队需要做的**：

```javascript
// App 后端推送代码示例（Node.js）
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', (ws) => {
  // 每 10 秒推送一次
  setInterval(() => {
    const riders = getAllRidersFromDB()  // 从骑手数据库取
    const positions = riders.map(rider => ({
      riderId: rider.id,
      lng: rider.currentLng,
      lat: rider.currentLat,
      status: rider.status,
      currentOrderId: rider.activeOrderId,
      batteryLevel: rider.battery
    }))
    ws.send(JSON.stringify({
      type: 'rider_positions_batch',
      ts: Date.now(),
      data: positions
    }))
  }, 10000)
})
```

## 🔌 切换步骤

```powershell
# 1. 在 Render Environment 加
RIDER_WS_URL=wss://app-rider-ws.公司域名.com/v1/riders/live
RIDER_API_TOKEN=xxx

# 2. 重新部署 → 自动切换
```

## 📋 字段映射

| 我们的字段 | 含义 | 类型 |
|---|---|---|
| `riderId` | 骑手 ID（与公司一致） | string |
| `lng` | 经度（GCJ-02 火星坐标）| number |
| `lat` | 纬度 | number |
| `status` | 状态（idle/delivering/rest/offline）| string |
| `currentOrderId` | 当前订单 ID（无则 null）| string |
| `batteryLevel` | 手机电量 0-100 | number |
| `cityId` | 城市（hengyang/shaoxing/changde/quzhou）| string |

## 📅 推进时间表

| 时间 | 任务 | 责任方 |
|---|---|---|
| **第 1 周** | 需求评审 + 字段确认 | App 团队 + 我们 |
| **第 2 周** | App 团队实现推送端点 | App 团队 |
| **第 3 周** | 联调 + 字段调整 | 双方 |
| **第 4 周** | 上线 + 监控 | App 团队 + 我们 |
