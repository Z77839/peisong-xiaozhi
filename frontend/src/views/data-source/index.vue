<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Close, Link, CircleClose, Setting, Connection, DataLine, User, ShoppingCart, Sunny, ChatLineRound, Microphone, Position } from '@element-plus/icons-vue'
import request from '@/api/request'

interface AdapterStatus {
  key: string
  name: string
  desc: string
  source: string
  configured: boolean
  preview: string | null
  envKey: string
  icon: any
  color: string
  docs: string
  difficulty: 'easy' | 'medium' | 'hard'
  cost: string
}

const adapters = ref<AdapterStatus[]>([
  {
    key: 'QWEATHER_API_KEY',
    name: '和风天气 API',
    desc: '实时天气数据 + 24小时预报（用于缺口预测与配送影响）',
    source: '和风天气 Web API',
    configured: false,
    preview: null,
    envKey: 'QWEATHER_API_KEY + QWEATHER_API_HOST',
    icon: Sunny,
    color: '#1f6feb',
    docs: 'https://dev.qweather.com/',
    difficulty: 'easy',
    cost: '个人免费版（1000次/天）'
  },
  {
    key: 'ELEME_APP_KEY',
    name: '饿了么 Open API',
    desc: '历史订单数据（90天订单流、商户分布、品类）',
    source: '饿了么开放平台',
    configured: false,
    preview: null,
    envKey: 'ELEME_APP_KEY + ELEME_APP_SECRET + ELEME_ACCESS_TOKEN',
    icon: ShoppingCart,
    color: '#ff9500',
    docs: 'https://open.ele.me/',
    difficulty: 'hard',
    cost: '需公司 OAuth 授权'
  },
  {
    key: 'RIDER_WS_URL',
    name: '骑手位置 WebSocket',
    desc: '实时骑手位置 + 状态（用于派单与异常监控）',
    source: '骑手 App WebSocket',
    configured: false,
    preview: null,
    envKey: 'RIDER_WS_URL + RIDER_API_TOKEN',
    icon: User,
    color: '#00b578',
    docs: '需公司 App 集成定位 SDK',
    difficulty: 'hard',
    cost: '需公司 App 团队开发'
  },
  {
    key: 'ORDER_STREAM_URL',
    name: '订单流 WebSocket',
    desc: '实时订单推送（用于预测与动态调度）',
    source: '订单系统 WebSocket',
    configured: false,
    preview: null,
    envKey: 'ORDER_STREAM_URL + ORDER_API_TOKEN',
    icon: DataLine,
    color: '#9b59ff',
    docs: '需公司订单系统对接',
    difficulty: 'hard',
    cost: '需公司订单系统改造'
  },
  {
    key: 'DOUBAO',
    name: '豆包 LLM（字节火山）',
    desc: '中文优化大模型（订单预测、决策报告、C端文案）',
    source: '火山引擎方舟 ARK',
    configured: false,
    preview: null,
    envKey: 'ARK_API_KEY',
    icon: ChatLineRound,
    color: '#3370ff',
    docs: 'https://www.volcengine.com/product/doubao',
    difficulty: 'easy',
    cost: '有免费额度，注册即领'
  },
  {
    key: 'DEEPSEEK',
    name: 'DeepSeek（推理备用）',
    desc: '推理强项（运力调度、成本优化、Pareto 求解）',
    source: 'DeepSeek Platform',
    configured: false,
    preview: null,
    envKey: 'DEEPSEEK_API_KEY',
    icon: Microphone,
    color: '#5e72e4',
    docs: 'https://platform.deepseek.com/',
    difficulty: 'easy',
    cost: '新用户送额度'
  }
])

const loading = ref(false)
const summary = ref({ configured: 0, total: 6 })

const fetchStatus = async () => {
  loading.value = true
  try {
    const r: any = await request({ url: '/debug/env-check' })
    const data = r?.adapters || {}
    adapters.value.forEach((a) => {
      const item = data[a.key]
      if (item) {
        a.configured = !!item.configured
        a.preview = item.preview
      }
    })
    summary.value.configured = adapters.value.filter((a) => a.configured).length
  } catch (e) {
    ElMessage.error('获取数据源状态失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStatus()
  // 每 10 秒自动刷新
  setInterval(fetchStatus, 10000)
})

const testAdapter = async (adapter: AdapterStatus) => {
  try {
    if (adapter.key === 'QWEATHER_API_KEY') {
      const r: any = await request({ url: '/adapters/weather/forecast?city=hengyang' })
      ElMessage.success(`和风天气测试成功：${r.current?.temp}°C ${r.current?.weather}`)
    } else if (adapter.key === 'ELEME_APP_KEY') {
      const r: any = await request({ url: '/adapters/orders/historical?city=hengyang&days=7' })
      ElMessage.success(`饿了么测试成功：${r.count} 单历史数据`)
    } else if (adapter.key === 'RIDER_WS_URL') {
      const r: any = await request({ url: '/adapters/riders/telemetry?city=hengyang' })
      ElMessage.success(`骑手遥测测试成功：${r.stats?.total || 0} 骑手在线`)
    } else if (adapter.key === 'ORDER_STREAM_URL') {
      const r: any = await request({ url: '/adapters/orders/pool?city=hengyang' })
      ElMessage.success(`订单流测试成功：${r.count} 单`)
    }
  } catch (e: any) {
    ElMessage.error(`测试失败：${e.message || '未知错误'}`)
  }
}

const difficultyMap = {
  easy: { label: '简单', type: 'success' },
  medium: { label: '中等', type: 'warning' },
  hard: { label: '较难', type: 'danger' }
} as const

// 演示场景
const demoResult = ref<any>(null)

const demoScenarios: Record<string, any> = {
  weekday: {
    title: '📅 工作日午后 · 稳定状态',
    metrics: [
      { label: '衡阳运力', value: '462/500', color: '#00b578' },
      { label: '准时率', value: '94.5%', color: '#1f6feb' },
      { label: '单均成本', value: '¥4.85', color: '#fa8c16' },
      { label: '预警数', value: '0', color: '#00b578' }
    ],
    action: '所有城市运力充足，无需特殊调度。系统平稳运行，各项指标在基准线附近。'
  },
  dinner: {
    title: '🍱 衡阳晚高峰 17-21 点',
    metrics: [
      { label: '订单量', value: '7,571', color: '#fa8c16' },
      { label: '缺口', value: '4,741', color: '#f56c6c' },
      { label: '预测准确率', value: '94.2%', color: '#1f6feb' },
      { label: '推荐方案', value: '众包+蜂跑', color: '#00b578' }
    ],
    action: '启动主动预防式决策：推荐众包+2 + 蜂跑+1 组合（¥1.65/单，节省 42.6%），启动高峰补贴预案，预警 9 次主动触发。'
  },
  rainy: {
    title: '🌧️ 衡阳暴雨极端天气',
    metrics: [
      { label: '天气影响系数', value: '1.65', color: '#f56c6c' },
      { label: '优远成本', value: '¥7.17 → ¥17.2', color: '#f56c6c' },
      { label: '建议', value: '暂停远单', color: '#fa8c16' },
      { label: '应急预案', value: '蜂跑启动', color: '#00b578' }
    ],
    action: '天气影响系数 1.65（暴雨+雷暴），远距离单成本激增。建议暂停优远远单，启动蜂跑应急运力 + 临时补贴。预估节省 ¥3.2 万/日。'
  },
  night: {
    title: '🌙 衡阳夜宵 02-05 点',
    metrics: [
      { label: '订单量', value: '387/h', color: '#9b59ff' },
      { label: '众包运力', value: '不足 30%', color: '#f56c6c' },
      { label: '建议', value: '蜂跑+专项', color: '#fa8c16' },
      { label: '补贴', value: '¥3/单', color: '#00b578' }
    ],
    action: '凌晨众包运力不足，启动蜂跑应急池（1200 骑手 10% 调拨），叠加 ¥3/单夜宵补贴，覆盖 95% 订单。'
  }
}

const loadDemoScenario = (key: string) => {
  demoResult.value = demoScenarios[key]
  ElMessage.success(`已加载场景：${demoScenarios[key].title}`)
}
</script>

<template>
  <div class="data-source-page">
    <!-- 顶部说明 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">🔌 真实数据接入端口</h1>
        <p class="page-desc">
          4 个数据接入端口（Adapter 模式），可从 mock 切到真实 API，零代码改动
        </p>
      </div>
      <el-button :icon="Connection" @click="fetchStatus" :loading="loading">刷新状态</el-button>
    </div>

    <!-- 总览卡片 -->
    <div class="overview-cards">
      <div class="overview-card primary">
        <div class="card-label">已接入</div>
        <div class="card-value">{{ summary.configured }} / {{ summary.total }}</div>
        <div class="card-trend">真实数据端口</div>
      </div>
      <div class="overview-card success">
        <div class="card-label">已运行</div>
        <div class="card-value">{{ summary.configured }}</div>
        <div class="card-trend">个 Adapter 在线</div>
      </div>
      <div class="overview-card warning">
        <div class="card-label">待接入</div>
        <div class="card-value">{{ summary.total - summary.configured }}</div>
        <div class="card-trend">需公司授权</div>
      </div>
      <div class="overview-card info">
        <div class="card-label">切换成本</div>
        <div class="card-value">0 行代码</div>
        <div class="card-trend">改环境变量即可</div>
      </div>
    </div>

    <!-- 4 个 Adapter 卡片 -->
    <div class="adapters-grid">
      <div
        v-for="adapter in adapters"
        :key="adapter.key"
        class="adapter-card"
        :class="{ configured: adapter.configured }"
      >
        <div class="adapter-header" :style="{ background: `linear-gradient(135deg, ${adapter.color}22, ${adapter.color}11)` }">
          <div class="adapter-icon" :style="{ background: adapter.color }">
            <el-icon :size="24" color="#fff">
              <component :is="adapter.icon" />
            </el-icon>
          </div>
          <div class="adapter-info">
            <div class="adapter-name">{{ adapter.name }}</div>
            <div class="adapter-source">{{ adapter.source }}</div>
          </div>
          <div class="adapter-status">
            <el-tag
              v-if="adapter.configured"
              type="success"
              effect="dark"
              size="default"
            >
              <el-icon><Check /></el-icon>
              <span>已接入</span>
            </el-tag>
            <el-tag
              v-else
              type="info"
              effect="plain"
              size="default"
            >
              <el-icon><Close /></el-icon>
              <span>Mock 模式</span>
            </el-tag>
          </div>
        </div>

        <div class="adapter-body">
          <div class="adapter-desc">{{ adapter.desc }}</div>

          <div class="adapter-meta">
            <div class="meta-row">
              <span class="meta-label">环境变量：</span>
              <code class="meta-code">{{ adapter.envKey }}</code>
            </div>
            <div class="meta-row">
              <span class="meta-label">接入难度：</span>
              <el-tag :type="difficultyMap[adapter.difficulty].type" size="small">
                {{ difficultyMap[adapter.difficulty].label }}
              </el-tag>
            </div>
            <div class="meta-row">
              <span class="meta-label">成本：</span>
              <span class="meta-value">{{ adapter.cost }}</span>
            </div>
            <div v-if="adapter.preview" class="meta-row">
              <span class="meta-label">当前值：</span>
              <code class="meta-code success">{{ adapter.preview }}</code>
            </div>
          </div>
        </div>

        <div class="adapter-footer">
          <el-button
            v-if="adapter.configured"
            type="success"
            size="small"
            plain
            :icon="Link"
            @click="testAdapter(adapter)"
          >
            测试连接
          </el-button>
          <el-button
            v-else
            type="primary"
            size="small"
            plain
            :icon="CircleClose"
            disabled
          >
            等待公司授权
          </el-button>
          <el-button
            size="small"
            :icon="Setting"
            @click="window.open(adapter.docs, '_blank')"
          >
            申请文档
          </el-button>
        </div>
      </div>
    </div>

    <!-- 架构说明 -->
    <div class="arch-section">
      <h2 class="section-title">🏗️ Adapter 模式架构</h2>
      <div class="arch-diagram">
        <div class="arch-layer">
          <div class="layer-label">业务逻辑层</div>
          <div class="layer-content">8 Agent 协同 + 3 个数学优化引擎</div>
        </div>
        <div class="arch-arrow">↓ 调用 ↓</div>
        <div class="arch-layer highlight">
          <div class="layer-label">Adapter 抽象层</div>
          <div class="layer-content">loadWeatherForecast() / loadOrderPool() / loadRiderTelemetry() / loadHistoricalOrders()</div>
        </div>
        <div class="arch-arrow">↓ 实现 ↓</div>
        <div class="arch-layer">
          <div class="layer-label">数据源层</div>
          <div class="layer-content">
            <span class="data-source mock">QWeatherAdapter (Mock)</span>
            <span class="data-source mock">EleOrderAdapter (Mock)</span>
            <span class="data-source mock">RiderTelemetryAdapter (Mock)</span>
            <span class="data-source mock">OrderPoolAdapter (Mock)</span>
          </div>
        </div>
      </div>
      <div class="arch-note">
        <el-icon><Check /></el-icon>
        <span>当 env var 配齐后，对应 Adapter 自动从 mock 切换到真实 API，业务代码 0 改动。</span>
      </div>
    </div>

    <!-- 接入指南 -->
    <div class="guide-section">
      <h2 class="section-title">📖 接入指南</h2>
      <ol class="guide-list">
        <li>
          <strong>申请 Key：</strong>按各端口要求申请（个人/公司）
        </li>
        <li>
          <strong>配 env：</strong>在 Render Dashboard Environment 加变量
        </li>
        <li>
          <strong>自动重启：</strong>Render 检测到 env 变化会自动重启服务
        </li>
        <li>
          <strong>验证：</strong>刷新本页，"已接入"数字 +1
        </li>
        <li>
          <strong>业务使用：</strong>所有 Agent 自动用真实数据，无需改代码
        </li>
      </ol>
    </div>

    <!-- 演示场景 -->
    <div class="demo-section">
      <h2 class="section-title">🎬 演示场景</h2>
      <p class="demo-desc">选一个场景，看看 4 个 Adapter 在不同数据状态下的协同效果：</p>
      <div class="demo-grid">
        <div class="demo-card" @click="loadDemoScenario('weekday')">
          <div class="demo-icon" style="background: #1f6feb">📅</div>
          <div class="demo-name">工作日午后</div>
          <div class="demo-desc">4 城市稳定状态，演示系统基线</div>
        </div>
        <div class="demo-card" @click="loadDemoScenario('dinner')">
          <div class="demo-icon" style="background: #ff9500">🍱</div>
          <div class="demo-name">晚高峰 17-21 点</div>
          <div class="demo-desc">衡阳缺口 4741 单，演示智能派单</div>
        </div>
        <div class="demo-card" @click="loadDemoScenario('rainy')">
          <div class="demo-icon" style="background: #00b578">🌧️</div>
          <div class="demo-name">衡阳暴雨</div>
          <div class="demo-desc">优远成本激增 2.4×，演示主动预警</div>
        </div>
        <div class="demo-card" @click="loadDemoScenario('night')">
          <div class="demo-icon" style="background: #9b59ff">🌙</div>
          <div class="demo-name">夜宵时段</div>
          <div class="demo-desc">众包运力不足，演示蜂跑应急</div>
        </div>
      </div>
      <div v-if="demoResult" class="demo-result">
        <h3>{{ demoResult.title }}</h3>
        <div class="demo-metrics">
          <div v-for="m in demoResult.metrics" :key="m.label" class="dm-item">
            <div class="dm-label">{{ m.label }}</div>
            <div class="dm-value" :style="{ color: m.color }">{{ m.value }}</div>
          </div>
        </div>
        <div class="demo-actions">
          <strong>AI 决策：</strong>{{ demoResult.action }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px 0;
}
.page-desc {
  font-size: 14px;
  color: #666;
  margin: 0;
}
.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.overview-card {
  padding: 20px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e8e8e8;
  position: relative;
  overflow: hidden;
  &.primary { border-top: 3px solid #1f6feb; }
  &.success { border-top: 3px solid #00b578; }
  &.warning { border-top: 3px solid #ff9500; }
  &.info { border-top: 3px solid #9b59ff; }
  .card-label {
    font-size: 13px;
    color: #666;
    margin-bottom: 8px;
  }
  .card-value {
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
  }
  .card-trend {
    font-size: 12px;
    color: #999;
    margin-top: 4px;
  }
}
.adapters-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}
.adapter-card {
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  transition: all 0.3s;
  &.configured {
    border-color: #00b578;
    box-shadow: 0 2px 12px rgba(0, 181, 120, 0.1);
  }
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
}
.adapter-header {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.adapter-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.adapter-info {
  flex: 1;
  .adapter-name {
    font-size: 17px;
    font-weight: 600;
    color: #1a1a2e;
    margin-bottom: 4px;
  }
  .adapter-source {
    font-size: 12px;
    color: #666;
  }
}
.adapter-body {
  padding: 20px;
}
.adapter-desc {
  font-size: 14px;
  color: #444;
  line-height: 1.6;
  margin-bottom: 16px;
}
.adapter-meta {
  .meta-row {
    display: flex;
    align-items: center;
    font-size: 13px;
    margin-bottom: 8px;
    .meta-label {
      color: #888;
      width: 80px;
      flex-shrink: 0;
    }
    .meta-code {
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      color: #333;
      &.success {
        background: #e8f8f0;
        color: #00b578;
      }
    }
    .meta-value {
      color: #444;
    }
  }
}
.adapter-footer {
  padding: 12px 20px;
  background: #fafafa;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.arch-section, .guide-section {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
  margin-bottom: 24px;
}
.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 20px 0;
}
.arch-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.arch-layer {
  width: 100%;
  max-width: 600px;
  padding: 16px 20px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  background: #fafbfc;
  text-align: center;
  &.highlight {
    border-color: #1f6feb;
    background: #f0f7ff;
  }
  .layer-label {
    font-size: 13px;
    font-weight: 600;
    color: #1f6feb;
    margin-bottom: 4px;
  }
  .layer-content {
    font-size: 14px;
    color: #333;
  }
}
.arch-arrow {
  font-size: 12px;
  color: #999;
  font-weight: 600;
}
.data-source {
  display: inline-block;
  padding: 4px 10px;
  margin: 2px;
  border-radius: 4px;
  font-size: 12px;
  &.mock {
    background: #fff7e6;
    color: #d48806;
    border: 1px solid #ffd591;
  }
}
.arch-note {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f0f9f4;
  border: 1px solid #b7e4c7;
  border-radius: 6px;
  color: #00b578;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.guide-list {
  padding-left: 20px;
  line-height: 1.8;
  font-size: 14px;
  color: #444;
  li {
    margin-bottom: 8px;
    strong {
      color: #1f6feb;
      margin-right: 4px;
    }
  }
}

// 演示场景
.demo-section {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
  margin-bottom: 24px;
}
.demo-desc {
  font-size: 14px;
  color: #666;
  margin: 0 0 20px 0;
}
.demo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.demo-card {
  padding: 16px;
  background: #fafbfc;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: #1f6feb;
  }
}
.demo-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 8px;
}
.demo-name { font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
.demo-desc { font-size: 12px; color: #666; line-height: 1.4; }
.demo-result {
  background: #f0f7ff;
  border: 1px solid #b3d8ff;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
  h3 { margin: 0 0 12px 0; font-size: 16px; color: #1f6feb; }
}
.demo-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.dm-item {
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
  text-align: center;
}
.dm-label { font-size: 11px; color: #666; margin-bottom: 4px; }
.dm-value { font-size: 16px; font-weight: 700; }
.demo-actions {
  font-size: 13px;
  color: #444;
  line-height: 1.6;
  strong { color: #1f6feb; margin-right: 4px; }
}
</style>
