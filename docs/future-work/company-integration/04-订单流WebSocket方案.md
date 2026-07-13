# 订单流 WebSocket 对接方案

> **目标**：从公司订单系统实时获取订单流（用于预测与动态调度）
> **对接方**：公司订单系统 / 平台对接团队
> **预计周期**：2-4 周

## 📧 协调邮件

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
收件人：[订单系统负责人] / 抄送：技术总监
主题：配送小智 - 实时订单流对接需求
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[负责人姓名] 您好：

「配送小智」AI 决策系统需要从订单系统实时获取订单推送，
用于订单预测、智能派单、异常监控。

具体技术需求：

1. 推送方式：WebSocket（推荐）或消息队列（Kafka/RabbitMQ）
2. 推送时机：新订单创建 / 订单状态变更
3. 推送频率：峰值 417 单/h（约 7 单/分钟）
4. 字段：订单 ID、商户、地址、金额、下单时间
5. 鉴权方式：Bearer Token

预计对接工作量：2-3 周
对接文档：见附件《订单流 WebSocket 推送规范》

需要订单系统团队支持：
□ 提供推送端点（WebSocket / Kafka）
□ 提供鉴权 Token
□ 推送字段格式对接
□ 联调测试

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔧 推送规范

### 端点

```
wss://order-stream.公司域名.com/v1/orders/live
```

### 推送时机

- 新订单创建（**关键**）
- 订单状态变更（已支付 / 配送中 / 已送达 / 已取消）
- 骑手接单 / 完成

### 消息格式

```json
{
  "type": "order_created",
  "ts": 1688000000000,
  "data": {
    "orderId": "O12345",
    "cityId": "hengyang",
    "merchantId": "M001",
    "riderId": null,                  // 初始无骑手
    "lng": 112.57,                     // 用户位置经度
    "lat": 26.89,                      // 用户位置纬度
    "amount": 35.5,                    // 订单金额
    "deliveryFee": 4.9,                // 配送费
    "status": "created",               // 订单状态
    "createdAt": 1688000000000,
    "expectedDelivery": 1688001800000  // 期望送达时间
  }
}
```

## 🔌 我们后端实现

**文件**：`backend/src/adapters/orderPoolAdapter.js`

```javascript
export async function loadOrderPool(cityId, timeRange = '1h') {
  if (ORDER_STREAM_URL) {
    // 真实模式：调公司订单流 API
  } else {
    // Mock 模式：模拟 417 单/h
  }
}
```

**Mock 模拟器**（已有）：
```javascript
function startOrderPoolSimulator() {
  setInterval(() => {
    // 模拟新订单涌入
    // 衡阳 417 单/h
  }, 10000)  // 每 10 秒一批
}
```

## 🔌 切换步骤

```powershell
# 加 env
ORDER_STREAM_URL=wss://order-stream.公司域名.com/v1/orders/live
ORDER_API_TOKEN=xxx
```

## 📅 推进时间表

| 时间 | 任务 | 责任方 |
|---|---|---|
| **第 1 周** | 需求评审 + 字段确认 | 订单系统 + 我们 |
| **第 2 周** | 订单系统实现推送 | 订单系统 |
| **第 3 周** | 联调 | 双方 |
| **第 4 周** | 上线 | 双方 |
