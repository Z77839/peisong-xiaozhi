# 饿了么 Open API 对接方案

> **目标**：让公司申请饿了么企业开发者，授权后我们接真实订单数据
> **对接方**：阿里本地生活公司
> **预计周期**：4-6 周
> **预算**：免费（企业开发者申请无费用）

## 📧 申请邮件（给公司 BD 经理，让他发给阿里）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
收件人：阿里本地生活 BD 经理
主题：申请饿了么 Open Platform 企业开发者账号
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

王经理/李经理，您好：

我们是浙江配送小智网络科技有限公司，是饿了么衡阳/绍兴/常德/衢州
4 城市的城市代理商。为了提升配送运营效率，我司已自主研发「配送小智」
AI 决策系统，希望通过 Open Platform 接入以下数据：

1. 历史订单数据（90 天）
2. 实时订单推送
3. 商户基础信息
4. 骑手状态数据

申请企业开发者账号需要您协助：

□ 推荐对接人姓名 / 邮箱
□ 推荐 Open Platform URL（https://open.ele.me/）
□ 协助发起企业认证流程
□ 提供 AppKey + AppSecret 申请

预计工作量：4-6 周技术对接
预期收益：提升运营效率 32%，单均成本下降 18%

附件：
- 《配送小智 - AI 配送运营系统》方案 PPT
- 《Open Platform 对接技术规范》

期待您的回复！

浙江配送小智
[姓名] [电话] [邮箱]
日期：2026-07-XX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🏢 申请流程（公司 BD 配合）

### 步骤 1：注册企业账号
- 访问 https://open.ele.me/
- 点 **企业开发者入驻**
- 填企业资料：营业执照 / 法人身份证 / 对公账户
- **审核时间**：3-5 个工作日

### 步骤 2：创建应用
- 应用名：配送小智
- 应用类型：内部系统
- 权限申请：
  - `order.query` — 历史订单
  - `order.push` — 实时订单（需审核）
  - `merchant.basic` — 商户信息
  - `rider.basic` — 骑手信息

### 步骤 3：获取凭证
拿到 3 个关键值：
- `AppKey`（公开）
- `AppSecret`（保密）
- `AccessToken`（OAuth 2.0 获取，定期刷新）

## 🔧 技术对接规范

### 我们后端已经实现的接口

**文件位置**：`backend/src/adapters/eleOrderAdapter.js`

**核心方法**：
```javascript
// 加载历史订单
export async function loadHistoricalOrders(cityId, days = 90) {
  // 调用饿了么 Open API: /v1/orders/historical
  // 返回 90 天的订单列表
}

// 实时订单推送（WebSocket）
// 文件: backend/src/adapters/orderPoolAdapter.js
export async function loadOrderPool(cityId, timeRange = '1h') {
  // 订阅饿了么订单推送 WebSocket
}
```

### 饿了么 API 调用示例（OAuth 2.0）

```javascript
// 1. 获取 AccessToken
POST https://open.ele.me/oauth/token
Headers: { Authorization: 'Basic base64(AppKey:AppSecret)' }
Body: grant_type=client_credentials

Response:
{
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "expires_in": 7200,
  "refresh_token": "..."
}

// 2. 调用历史订单 API
GET https://open.ele.me/v1/orders/historical
Headers: { Authorization: 'Bearer <access_token>' }
Query:
  - city: 衡阳
  - start_date: 2026-04-01
  - end_date: 2026-07-01
  - page: 1
  - page_size: 100
```

### OAuth 2.0 实现要点

**AccessToken 缓存策略**（我们后端需要实现）：
```javascript
let cachedToken = null
let tokenExpiresAt = 0

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken  // 缓存命中
  }
  // 重新获取
  const res = await axios.post('https://open.ele.me/oauth/token', {
    grant_type: 'client_credentials'
  }, {
    headers: { Authorization: `Basic ${Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64')}` }
  })
  cachedToken = res.data.access_token
  tokenExpiresAt = Date.now() + res.data.expires_in * 1000
  return cachedToken
}
```

## 🔌 切换步骤（拿到 Key 后 30 分钟）

```powershell
# 1. 在 Render Environment 加 3 个变量
ELEME_APP_KEY=xxx
ELEME_APP_SECRET=xxx
ELEME_ACCESS_TOKEN=xxx

# 2. 重新部署
# Render 自动重启服务

# 3. 验证
Invoke-WebRequest https://peisong-backend.onrender.com/api/debug/env-check
# 看 ELEME_APP_KEY.configured 应该是 true

Invoke-WebRequest "https://peisong-backend.onrender.com/api/adapters/orders/historical?city=hengyang&days=7"
# 返回真实订单数据，不再是 mock
```

## 📋 数据字段映射

饿了么返回字段 → 我们的字段：
```javascript
{
  order_id: 'ele_xxx',           // 饿了么订单 ID
  city: 'hengyang',             // 城市
  merchant_id: 'm_xxx',         // 商户 ID
  rider_id: 'r_xxx',            // 骑手 ID
  create_time: 1688000000,      // 下单时间戳
  amount: 35.5,                 // 订单金额
  delivery_fee: 4.9,            // 配送费
  status: 'delivered',          // 订单状态
  // ... 其他字段
}

// 转换为我们系统的字段
{
  id: order.order_id,
  city: mapCity(order.city),
  merchantId: order.merchant_id,
  riderId: order.rider_id,
  createdAt: new Date(order.create_time * 1000),
  amount: order.amount,
  cost: order.delivery_fee,
  status: mapStatus(order.status)
}
```

## ⚠️ 注意事项

1. **API 限流**：饿了么 Open API 限制 QPS 100，超出返回 429
2. **数据合规**：订单数据涉及消费者隐私，需公司签订《数据保密协议》
3. **费用**：免费，但有调用配额限制
4. **审核**：实时订单推送（order.push）权限审核较严，需说明用途

## 📞 联系人

- **饿了么 Open Platform 客服**：https://open.ele.me/support
- **阿里本地生活 BD**：王经理（由公司 BD 部门联系）

## 📅 推进时间表

| 时间 | 任务 | 责任方 |
|---|---|---|
| **第 1 周** | 公司内部讨论 + 申请企业开发者 | BD 部门 |
| **第 2 周** | 提交资料 + 阿里审核 | BD + 阿里 |
| **第 3 周** | 创建应用 + 申请权限 | BD + 阿里 |
| **第 4 周** | 拿到 AppKey + AppSecret | BD → 我们 |
| **第 5-6 周** | 技术对接 + 联调 | 我们 + 阿里技术支持 |
| **第 7 周** | 上线 + 监控 | 我们 |
