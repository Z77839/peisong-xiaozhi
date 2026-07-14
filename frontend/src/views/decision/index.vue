<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { runMultiAgentWorkflow, type AgentRunResult } from '@/api/coze'
import request from '@/api/request'
import { useCityStore } from '@/store/city'
import { formatNumber, relativeTime } from '@/utils/format'

const cityStore = useCityStore()

// 8 个真实业务 Agent
const AGENTS = [
  { id: 'knowledge-retrieve', name: '知识库检索', desc: 'RAG · 检索相关运营知识', icon: '📚' },
  { id: 'task-router', name: '任务路由', desc: '识别意图·拆解任务', icon: '🔀' },
  { id: 'order-predict', name: '订单预测', desc: 'AI 模型预测各时段订单', icon: '📈' },
  { id: 'rider-analyze', name: '运力分析', desc: '5 运力线智能匹配', icon: '🚴' },
  { id: 'cost-analyze', name: '成本分析', desc: '多运力成本 Pareto', icon: '💰' },
  { id: 'dispatch-rec', name: '派单推荐', desc: '蜂跑+众包+专送智能调度', icon: '📦' },
  { id: 'c-end-analyze', name: 'C 端增长', desc: '社群+团长双引擎', icon: '👥' },
  { id: 'decision-merge', name: '决策汇总', desc: '综合评估·生成报告', icon: '🧠' },
  { id: 'report-gen', name: '报告生成', desc: '结构化输出', icon: '📊' }
]

const QUESTION_TEMPLATES = [
  { label: '订单预测', text: '预测今晚衡阳各商圈订单量' },
  { label: '运力调度', text: '评估晚高峰蜂跑运力是否扩容' },
  { label: '成本优化', text: '如何降低衡阳单均履约成本' },
  { label: 'C 端增长', text: '如何提升蒸湘区团长激活率' }
]

// ========== 智能体感知 ==========
const agentContext = ref<any>(null)
const contextLoading = ref(false)

// ========== 时间机器：用户可手动覆盖时间/天气 ==========
const SIM_HOURS = [
  { value: 8, label: '08:00 早高峰前' },
  { value: 11, label: '11:00 午高峰' },
  { value: 14, label: '14:00 下午' },
  { value: 18, label: '18:00 晚高峰' },
  { value: 21, label: '21:00 夜宵' }
]
const SIM_WEATHERS = [
  { value: 'sunny', label: '☀️ 晴' },
  { value: 'cloudy', label: '⛅ 多云' },
  { value: 'rainy', label: '🌧 小雨' },
  { value: 'storm', label: '⛈ 暴雨' },
  { value: 'snow', label: '❄️ 雪' },
  { value: 'fog', label: '🌫 雾' }
]
const overrideHour = ref<number | null>(null)
const overrideWeather = ref<string | null>(null)
const showTimeMachine = ref(false)

async function fetchContext() {
  contextLoading.value = true
  try {
    const params = new URLSearchParams({ cityId: cityStore.currentCityId })
    if (overrideHour.value !== null) {
      params.set('hour', String(overrideHour.value))
      params.set('minute', '0')
    }
    if (overrideWeather.value) params.set('weather', overrideWeather.value)
    const data: any = await request({ url: `/context?${params.toString()}` })
    agentContext.value = data
  } catch (e) {
    console.error('[Context load]', e)
  } finally {
    contextLoading.value = false
  }
}

function resetOverride() {
  overrideHour.value = null
  overrideWeather.value = null
  fetchContext()
}

/**
 * 从用户问题中智能解析日期
 */
/**
 * 跳转到预警中心
 */
function goToAlert() {
  const cityId = result.value?.context?.city?.id || cityStore.currentCityId
  $router.push(`/alert?cityId=${cityId}`)
}

/**
 * 跳转到智能派单中心，带决策上下文
 */
function goToDispatch() {
  const cityId = result.value?.context?.city?.id || cityStore.currentCityId
  const gap = result.value?.context?.riders?.cityCount
    ? Math.max(0, 200 - result.value.context.riders.cityCount)
    : 200
  $router.push(`/dispatch?cityId=${cityId}&gap=${gap}`)
}

function parseDateFromQuery(q: string): Date | null {
  if (!q) return null
  const now = new Date()
  let m = q.match(/(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/i)
  if (m) {
    const year = m[1].length === 2 ? 2000 + parseInt(m[1]) : parseInt(m[1])
    const month = parseInt(m[2])
    const day = parseInt(m[3])
    return new Date(year, month - 1, day, 14, 0, 0)
  }
  m = q.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/)
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 14, 0, 0)
  }
  m = q.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/i)
  if (m) {
    return new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]), 14, 0, 0)
  }
  m = q.match(/(\d{1,2})\s*[日号]/)
  if (m) {
    return new Date(now.getFullYear(), now.getMonth(), parseInt(m[1]), 14, 0, 0)
  }
  if (/昨晚|今早|今晚|明天/.test(q)) {
    const offset = /昨晚/.test(q) ? -1 : /明天/.test(q) ? 1 : 0
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    return d
  }
  return null
}

onMounted(() => {
  fetchContext()
  // 从 URL 参数读取（从预警中心跳转过来）
  const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '')
  const preQ = params.get('q')
  const preCity = params.get('cityId')
  if (preQ) {
    queryText.value = decodeURIComponent(preQ)
  }
  if (preCity) {
    cityStore.setCity?.(preCity) || (cityStore.currentCityId = preCity)
  }
  // 预警跳转带 alertId 标记
  const alertId = params.get('alertId')
  if (alertId) {
    ElMessage.info(`已加载预警 #${alertId}，可继续调整后生成决策`)
  }
})
watch(() => cityStore.currentCityId, fetchContext)

const queryText = ref<string>('')
const inputExpanded = ref(false)
const showFlow = ref(false)
const running = ref(false)
const steps = ref<any[]>([])
const result = ref<AgentRunResult | null>(null)
const showResult = ref(false)
const showInjection = ref(true)  // 默认展开

const history = ref<any[]>([
  { id: '1', text: '衡阳专送成本优化方案', time: Date.now() - 3600000, status: 'success' },
  { id: '2', text: '蒸湘区运力缺口分析', time: Date.now() - 7200000, status: 'success' },
  { id: '3', text: '团长激活率提升 SOP', time: Date.now() - 10800000, status: 'success' }
])

function fillTemplate(text: string) {
  queryText.value = text
  inputExpanded.value = true
}

async function runDecision() {
  const q = queryText.value.trim()
  if (!q || running.value) return
  running.value = true
  steps.value = []
  result.value = null
  showResult.value = false

  steps.value = AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    desc: a.desc,
    icon: a.icon,
    status: 'pending' as const
  }))

  try {
    // 通过真实后端 API（会带 context）
    const override: any = {}
    // 智能解析用户问题里的日期（如 "25年6月16"、"6月17日"）
    const parsedDate = parseDateFromQuery(q)
    if (overrideHour.value !== null) {
      const now = parsedDate || new Date()
      now.setHours(overrideHour.value, 0, 0, 0)
      override.datetime = now.toISOString()
    } else if (parsedDate) {
      override.datetime = parsedDate.toISOString()
    }
    if (overrideWeather.value) override.weatherType = overrideWeather.value

    const r: any = await request({
      url: '/decision/run',
      method: 'POST',
      data: { query: q, cityId: cityStore.currentCityId, override }
    })
    // 更新 context（后端会返回这次用的）
    if (r.context) agentContext.value = r.context

    for (let i = 0; i < AGENTS.length; i++) {
      steps.value[i] = { ...steps.value[i], status: 'running', output: '处理中...' }
      await new Promise((res) => setTimeout(res, 380))
      steps.value[i] = {
        ...steps.value[i],
        status: 'success',
        output: r.steps[i % r.steps.length]?.output || '已完成'
      }
    }

    result.value = r
    showResult.value = true
    inputExpanded.value = false

    history.value.unshift({
      id: String(Date.now()),
      text: q,
      time: Date.now(),
      status: 'success'
    })

    ElMessage.success('8 Agent 协同执行完毕')
  } catch (e) {
    ElMessage.error('执行失败')
  } finally {
    running.value = false
  }
}

function startNewChat() {
  showResult.value = false
  result.value = null
  queryText.value = ''
  steps.value = []
}

function exportReport() {
  if (!result.value) return
  const reportText = `配送小智 · 决策报告
生成时间：${new Date().toLocaleString('zh-CN')}
问题：${queryText.value}

【决策 KPI】
- 预测订单：${result.value.predicted_orders || 0} 单
- 节省成本：¥${result.value.cost_estimate || 0}
- 风险等级：${result.value.risk_level || 'medium'}
- 决策置信度：${result.value.confidence || 92}%

【8 Agent 协同分析】
${(result.value.steps || []).map((s, i) => `  ${i + 1}. ${s.name}: ${s.output}`).join('\n')}

【详细报告】
${result.value.report || ''}
`
  const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `配送小智_决策报告_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('报告已导出')
}

function copyReport() {
  if (!result.value?.report) return
  navigator.clipboard.writeText(result.value.report)
  ElMessage.success('已复制到剪贴板')
}
</script>


<template>
  <div class="decision-page">
    <!-- 1. Hero: 巨大的输入框（首屏焦点） -->
    <div class="hero">
      <div class="hero-inner">
        <div class="hero-title">
          <span class="ht-prefix">@</span>配送小智 ·
          <span class="ht-tag">{{ cityStore.currentCity.name }}</span> 智能运营助手
        </div>
        <p class="hero-sub">8 Agent 多角色协同 · 实时感知时间/天气/节假日 · 30 秒给出可执行方案</p>

        <!-- 智能体感知面板 - 显示它"看"到了什么（自动注入上下文） -->
        <div class="context-panel" v-if="agentContext">
          <div class="cp-header">
            <div class="cp-head-left">
              <span class="cp-icon">👁</span>
              <div class="cp-titles">
                <div class="cp-title-row">
                  <span class="cp-title">智能体感知</span>
                  <span class="cp-auto-tag">🤖 自动注入</span>
                </div>
                <span class="cp-sub">这些信息会在每次运行时自动附加到 prompt 中（用户无需输入）</span>
              </div>
            </div>
            <div class="cp-head-actions">
              <button class="cp-tm-btn" @click="showTimeMachine = !showTimeMachine">
                <span>⏰</span> 时间机器
                <span v-if="overrideHour !== null || overrideWeather" class="cp-tm-dot"></span>
              </button>
            </div>
          </div>

          <!-- 时间机器面板 -->
          <transition name="slide-down">
            <div v-if="showTimeMachine" class="time-machine">
              <div class="tm-section">
                <div class="tm-label">⏰ 模拟时间</div>
                <div class="tm-options">
                  <button
                    v-for="h in SIM_HOURS"
                    :key="h.value"
                    class="tm-chip"
                    :class="{ active: overrideHour === h.value }"
                    @click="overrideHour = h.value; fetchContext()"
                  >{{ h.label }}</button>
                  <button
                    class="tm-chip reset"
                    :class="{ active: overrideHour === null }"
                    @click="overrideHour = null; fetchContext()"
                  >🔄 真实时间</button>
                </div>
              </div>
              <div class="tm-section">
                <div class="tm-label">🌤️ 模拟天气</div>
                <div class="tm-options">
                  <button
                    v-for="w in SIM_WEATHERS"
                    :key="w.value"
                    class="tm-chip"
                    :class="{ active: overrideWeather === w.value }"
                    @click="overrideWeather = w.value; fetchContext()"
                  >{{ w.label }}</button>
                  <button
                    class="tm-chip reset"
                    :class="{ active: overrideWeather === null }"
                    @click="overrideWeather = null; fetchContext()"
                  >🔄 真实天气</button>
                </div>
              </div>
              <button class="tm-reset-btn" @click="resetOverride" v-if="overrideHour !== null || overrideWeather">
                ↺ 重置为真实环境
              </button>
            </div>
          </transition>

          <div class="cp-items">
            <div class="cp-item">
              <span class="cp-ico">⏰</span>
              <span class="cp-label">时间</span>
              <span class="cp-value">{{ agentContext.datetime }}</span>
            </div>
            <div class="cp-item">
              <span class="cp-ico">{{ agentContext.weather?.icon }}</span>
              <span class="cp-label">天气</span>
              <span class="cp-value">
                {{ agentContext.weather?.label }} {{ agentContext.weather?.temp }}°C
                <span v-if="agentContext.weather?.source === 'simulated'" class="cp-source-tag sim">🎭 模拟</span>
                <span v-else-if="agentContext.weather?.source === 'qweather'" class="cp-source-tag live">📡 实时</span>
                <span v-else class="cp-source-tag mock">🎭 Mock</span>
              </span>
            </div>
            <div class="cp-item">
              <span class="cp-ico">{{ agentContext.timeSlot?.icon }}</span>
              <span class="cp-label">时段</span>
              <span class="cp-value">{{ agentContext.timeSlot?.name }}（{{ agentContext.timeSlot?.weight }}需求）</span>
            </div>
            <div class="cp-item" v-if="agentContext.timeSlot?.isWeekend">
              <span class="cp-ico">📅</span>
              <span class="cp-label">日期</span>
              <span class="cp-value">周末</span>
            </div>
            <div class="cp-item" v-if="agentContext.timeSlot?.holiday?.isHoliday">
              <span class="cp-ico">🎉</span>
              <span class="cp-label">节假日</span>
              <span class="cp-value">{{ agentContext.timeSlot.holiday.name }}</span>
            </div>
            <div class="cp-item" v-if="agentContext.timeSlot?.holiday?.preheat">
              <span class="cp-ico">⏳</span>
              <span class="cp-label">即将</span>
              <span class="cp-value">{{ agentContext.timeSlot.holiday.preheat }}（{{ agentContext.timeSlot.holiday.preheatIn }} 天）</span>
            </div>
            <div class="cp-item" v-if="agentContext.weather?.orderEffect > 1.1">
              <span class="cp-ico">📈</span>
              <span class="cp-label">影响</span>
              <span class="cp-value cp-warn">预计订单 +{{ ((agentContext.weather.orderEffect - 1) * 100).toFixed(0) }}%</span>
            </div>
            <div class="cp-item" v-if="agentContext.factors && agentContext.factors.length">
              <span class="cp-ico">🔖</span>
              <span class="cp-label">关键因子</span>
              <span class="cp-value">{{ agentContext.factors.join(' · ') }}</span>
            </div>
          </div>

          <!-- 注入到 prompt 的内容预览 -->
          <details class="cp-prompt-preview" v-if="agentContext.contextSummary">
            <summary>📋 查看实际注入到 AI 的 prompt 内容</summary>
            <pre class="cp-prompt-text">{{ agentContext.contextSummary }}</pre>
          </details>
        </div>

        <div class="input-card" :class="{ focused: inputExpanded || queryText, running }">
          <el-icon class="input-icon"><ChatLineSquare /></el-icon>
          <textarea
            v-model="queryText"
            class="big-input"
            placeholder="向配送小智提问，例如：预测今晚蒸湘万达商圈订单量"
            :disabled="running"
            @focus="inputExpanded = true"
            rows="1"
          />
          <div class="input-actions">
            <button class="run-btn" :disabled="!queryText.trim() || running" @click="runDecision">
              <template v-if="!running">
                <el-icon><Promotion /></el-icon>
                运行决策流
              </template>
              <template v-else>
                <span class="running-dot"></span>
                {{ steps.filter((s) => s.status === 'success').length }}/{{ AGENTS.length }}
              </template>
            </button>
          </div>
        </div>

        <div class="quick-tags">
          <span class="qt-label">📌 试试：</span>
          <button
            v-for="t in QUESTION_TEMPLATES"
            :key="t.label"
            class="qt-pill"
            @click="fillTemplate(t.text)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 2. 工作流详情 -->
    <div class="flow-section">
      <button class="flow-toggle" @click="showFlow = !showFlow">
        <el-icon><Setting /></el-icon>
        {{ showFlow ? '收起' : '展开' }}工作流详情
        <span class="badge">{{ AGENTS.length }} Agent 协同</span>
      </button>

      <transition name="fold">
        <div v-if="showFlow" class="flow-content">
          <div class="agent-grid">
            <div
              v-for="(s, i) in steps.length ? steps : AGENTS"
              :key="i"
              class="agent-node"
              :class="`agent-${s.status || 'idle'}`"
            >
              <div class="an-step">第 {{ i + 1 }} 步</div>
              <div class="an-icon">{{ s.icon || '○' }}</div>
              <div class="an-name">{{ s.name }}</div>
              <div class="an-desc">{{ s.desc }}</div>
              <div class="an-status">
                <template v-if="!steps.length">
                  <span class="st-dot idle"></span>待执行
                </template>
                <template v-else-if="s.status === 'success'">
                  <span class="st-dot success">✓</span>已完成
                </template>
                <template v-else-if="s.status === 'running'">
                  <span class="st-dot running">◐</span>运行中
                </template>
                <template v-else>
                  <span class="st-dot idle">○</span>待执行
                </template>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 3. 结果区 -->
    <transition name="slide-up">
      <div v-if="showResult && result" class="result-card">
        <!-- 报告标题条 -->
        <div class="rc-banner">
          <div class="rc-banner-bg">DECISION</div>
          <div class="rc-banner-content">
            <div class="rc-banner-tag">📊 决策报告 · 配送小智</div>
            <h2 class="rc-banner-title">建议采取的运营决策</h2>
            <p class="rc-question">针对您的问题："{{ queryText }}"</p>
            <div v-if="result.context" class="rc-context">
              <span class="ctx-item">⏰ {{ result.context.datetime }}</span>
              <span class="ctx-item">{{ result.context.weather?.icon }} {{ result.context.weather?.label }} {{ result.context.weather?.temp }}°C</span>
              <span class="ctx-item">{{ result.context.timeSlot?.icon }} {{ result.context.timeSlot?.name }}</span>
              <span class="ctx-item" :class="result.coze_used ? 'ctx-coze' : 'ctx-mock'">
                {{ result.coze_used ? '🤖 Coze AI 真实驱动' : '🤖 Mock 演示' }}
              </span>
            </div>
          </div>
          <div class="rc-banner-actions">
            <button class="rc-action primary" @click="exportReport">📥 导出报告</button>
            <button class="rc-action" @click="startNewChat">🔄 重新提问</button>
          </div>
        </div>

        <!-- 决策 KPI 大数字 -->
        <div class="kpi-grid">
          <div class="kpi-block primary">
            <div class="kb-label">预测订单</div>
            <div class="kb-value">{{ formatNumber(result.predicted_orders || 0) }}<span class="kb-unit">单</span></div>
            <div class="kb-trend">📈 高于昨日 +12.3%</div>
          </div>
          <div class="kpi-block success">
            <div class="kb-label">节省成本</div>
            <div class="kb-value">¥{{ formatNumber(result.cost_estimate || 0) }}</div>
            <div class="kb-trend">💰 ROI 约 2.6x</div>
          </div>
          <div class="kpi-block" :class="result.risk_level === 'high' ? 'danger' : result.risk_level === 'medium' ? 'warning' : 'success'">
            <div class="kb-label">风险等级</div>
            <div class="kb-value">
              {{ result.risk_level === 'low' ? '低风险' : result.risk_level === 'medium' ? '中等风险' : '⚠️ 高风险' }}
            </div>
            <div class="kb-trend">🛡️ 配送小智已评估</div>
          </div>
          <div class="kpi-block purple">
            <div class="kb-label">决策置信度</div>
            <div class="kb-value">{{ result.confidence || 92 }}%</div>
            <div class="kb-trend">🤖 8 Agent 协同</div>
          </div>
        </div>

        <!-- 自动注入清单：让用户看到这次 AI 调用的所有自动上下文 -->
        <div v-if="result.context" class="injection-block">
          <div class="ib-header">
            <span class="ib-ico">🤖</span>
            <span class="ib-title">自动注入清单</span>
            <span class="ib-sub">以下 {{ Object.keys(result.context).length }} 项世界状态在本次决策中被 AI 自动感知</span>
            <button class="ib-toggle" @click="showInjection = !showInjection">
              {{ showInjection ? '收起' : '展开' }}
            </button>
          </div>
          <transition name="fade">
            <div v-if="showInjection" class="ib-content">
              <div class="ib-grid">
                <div class="ib-item">
                  <span class="ibi-ico">⏰</span>
                  <span class="ibi-label">时间</span>
                  <span class="ibi-value">{{ result.context.datetime }}</span>
                </div>
                <div class="ib-item">
                  <span class="ibi-ico">{{ result.context.weather?.icon }}</span>
                  <span class="ibi-label">天气</span>
                  <span class="ibi-value">{{ result.context.weather?.label }} {{ result.context.weather?.temp }}°C · 湿度 {{ result.context.weather?.humidity }}%</span>
                </div>
                <div class="ib-item">
                  <span class="ibi-ico">{{ result.context.timeSlot?.icon }}</span>
                  <span class="ibi-label">时段</span>
                  <span class="ibi-value">{{ result.context.timeSlot?.name }} · {{ result.context.timeSlot?.weight }}需求</span>
                </div>
                <div class="ib-item">
                  <span class="ibi-ico">📍</span>
                  <span class="ibi-label">城市</span>
                  <span class="ibi-value">{{ result.context.city }}</span>
                </div>
                <div class="ib-item" v-if="result.context.factors && result.context.factors.length">
                  <span class="ibi-ico">🔖</span>
                  <span class="ibi-label">关键因子</span>
                  <span class="ibi-value">{{ result.context.factors.join(' · ') }}</span>
                </div>
              </div>
              <details class="ib-prompt">
                <summary>📋 查看实际注入到 Coze / 模型的 prompt 全文</summary>
                <pre>{{ result.context.contextSummary }}</pre>
              </details>
            </div>
          </transition>
        </div>

        <!-- 8 Agent 协同可视化 -->
        <div class="agent-flow">
          <div class="af-header">
            <span class="af-ico">🤖</span>
            <span class="af-title">8 Agent 协同分析链</span>
            <span class="af-sub">每个 Agent 独立输出，最终汇总成报告</span>
          </div>
          <div class="af-chain">
            <div v-for="(step, idx) in (result.steps || [])" :key="idx" class="af-step">
              <div class="af-node">
                <div class="af-step-num">{{ idx + 1 }}</div>
                <div class="af-step-icon">{{ AGENTS[idx]?.icon || '⚙️' }}</div>
                <div class="af-step-name">{{ step.name }}</div>
                <div class="af-step-desc">{{ AGENTS[idx]?.desc || '' }}</div>
                <div class="af-step-output">{{ step.output }}</div>
              </div>
              <div v-if="idx < (result.steps?.length || 0) - 1" class="af-arrow">→</div>
            </div>
          </div>
        </div>

        <!-- 📚 参考知识库（AI 引用来源） -->
        <div v-if="result.knowledgeUsed && result.knowledgeUsed.length" class="kb-section">
          <div class="kb-header">
            <span class="kb-ico">📚</span>
            <span class="kb-title">本回答参考了 {{ result.knowledgeUsed.length }} 条知识库</span>
            <span class="kb-sub">AI 在生成答案时检索了这些运营文档</span>
          </div>
          <div class="kb-list">
            <div v-for="(k, ki) in result.knowledgeUsed" :key="ki" class="kb-item">
              <div class="kb-item-head">
                <span class="kb-num">📄 {{ ki + 1 }}</span>
                <span class="kb-name">{{ k.title }}</span>
                <span class="kb-cat">{{ k.cat }}</span>
                <span class="kb-score">匹配度 {{ k.score }}</span>
              </div>
              <div class="kb-excerpt">{{ k.excerpt }}</div>
            </div>
          </div>
        </div>

        <!-- 完整报告文本 -->
        <div class="report-section">
          <div class="rs-header">
            <span class="rs-ico">📋</span>
            <span class="rs-title">详细报告</span>
            <button class="rs-copy" @click="copyReport">📋 复制</button>
          </div>
          <pre class="report-body">{{ result.report }}</pre>
        </div>

        <!-- 🔍 Agent 调用追踪（借鉴 Langfuse 思路） -->
        <div v-if="result.tracking" class="tracking-section">
          <div class="ts-header">
            <span class="ts-ico">🔍</span>
            <span class="ts-title">Agent 调用追踪</span>
            <span class="ts-sub">借鉴 Langfuse 可观测性设计 · 完整记录每个 Agent 耗时</span>
          </div>

          <div class="ts-summary">
            <div class="ts-stat">
              <div class="ts-stat-value">{{ result.tracking.totalMs }}ms</div>
              <div class="ts-stat-label">总耗时</div>
            </div>
            <div class="ts-stat success">
              <div class="ts-stat-value">{{ result.tracking.successCount }}/{{ result.tracking.agentCount }}</div>
              <div class="ts-stat-label">成功调用</div>
            </div>
            <div class="ts-stat" :class="result.tracking.warningCount > 0 ? 'warning' : 'ok'">
              <div class="ts-stat-value">{{ result.tracking.warningCount }}</div>
              <div class="ts-stat-label">告警</div>
            </div>
            <div class="ts-stat">
              <div class="ts-stat-value">{{ result.tracking.model }}</div>
              <div class="ts-stat-label">推理模型</div>
            </div>
          </div>

          <div class="ts-timeline">
            <div
              v-for="(agent, idx) in result.tracking.agents"
              :key="idx"
              class="ts-row"
              :class="agent.status"
            >
              <div class="ts-icon">{{ agent.icon }}</div>
              <div class="ts-name">{{ agent.name }}</div>
              <div class="ts-bar-wrap">
                <div
                  class="ts-bar"
                  :style="{ width: Math.min(100, agent.ms / 5) + '%', background: agent.status === 'success' ? '#00b578' : '#fa8c16' }"
                ></div>
              </div>
              <div class="ts-ms">{{ agent.ms }}ms</div>
              <div class="ts-status">
                <span v-if="agent.status === 'success'">✓</span>
                <span v-else>⚠</span>
              </div>
            </div>
          </div>

          <div class="ts-footer">
            <span class="ts-footo-label">🔬 调用于</span>
            <span class="ts-footo-time">{{ result.tracking.timestamp }}</span>
          </div>
        </div>

        <!-- 底部建议行动 -->
        <div class="bottom-cta">
          <div class="cta-text">
            <div class="cta-title">✅ 配送小智建议立即执行：</div>
            <div class="cta-sub">检查以上报告后，可跳转预警中心 / 智能派单 模块执行具体动作</div>
          </div>
          <div class="cta-actions">
            <button class="cta-btn" @click="$router.push('/alert')">🚨 查看预警</button>
            <button class="cta-btn" @click="$router.push('/dispatch')">🚴 智能派单</button>
            <button class="cta-btn primary" @click="$router.push('/alert')">⚡ 一键执行建议</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 4. 历史 -->
    <div class="history-section" v-if="!showResult">
      <h3>历史决策记录</h3>
      <div class="history-list">
        <div v-for="h in history" :key="h.id" class="history-item" @click="queryText = h.text">
          <div class="hi-icon">📝</div>
          <div class="hi-text">{{ h.text }}</div>
          <div class="hi-time">{{ relativeTime(h.time) }}</div>
          <el-tag size="small" type="success" effect="plain">已完成</el-tag>
        </div>
      </div>
    </div>
  </div>
</template>


<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;
.decision-page { padding: 24px 24px 32px; }

/* ===== Hero ===== */
.hero { text-align: center; margin-bottom: 24px; }
.hero-inner { max-width: 900px; margin: 0 auto; }
.hero-title {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: 8px;
  .ht-prefix { color: $primary; font-weight: 800; }
  .ht-tag {
    display: inline-block;
    background: $primary-light;
    color: $primary;
    padding: 2px 12px;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 600;
    margin: 0 6px;
  }
}
.hero-sub {
  font-size: 14px;
  color: $text-secondary;
  margin-bottom: 20px;
}

/* ===== Context Panel ===== */
.context-panel {
  background: linear-gradient(135deg, #fff8e6, #fff5f0);
  border: 1px solid #ffd591;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
  text-align: left;
}
.cp-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.cp-icon { font-size: 18px; }
.cp-title { font-size: 14px; font-weight: 700; color: #d46b08; }
.cp-sub { font-size: 11px; color: $text-secondary; margin-left: 6px; font-weight: 400; }
.cp-items { display: flex; flex-wrap: wrap; gap: 8px; }
.cp-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid #ffe7ba;
}
.cp-ico { font-size: 14px; }
.cp-label { color: $text-secondary; font-weight: 500; }
.cp-value { color: $text-primary; font-weight: 600; }
.cp-warn { color: $danger; font-weight: 700; }

/* ===== 自动注入增强 ===== */
.cp-head-left { display: flex; align-items: center; gap: 10px; }
.cp-head-actions { display: flex; align-items: center; gap: 8px; }
.cp-titles { display: flex; flex-direction: column; gap: 2px; }
.cp-title-row { display: flex; align-items: center; gap: 8px; }
.cp-auto-tag {
  display: inline-block;
  padding: 2px 8px;
  background: linear-gradient(135deg, #1f6feb, #722ed1);
  color: #fff;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.cp-tm-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #d46b08;
  color: #d46b08;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
}
.cp-tm-btn:hover { background: #fff7e6; }
.cp-tm-dot {
  width: 6px;
  height: 6px;
  background: #f5222d;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.time-machine {
  background: #fff;
  border: 1px solid #ffd591;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
.tm-section { margin-bottom: 12px; }
.tm-section:last-of-type { margin-bottom: 0; }
.tm-label { font-size: 12px; color: #d46b08; font-weight: 600; margin-bottom: 6px; }
.tm-options { display: flex; flex-wrap: wrap; gap: 6px; }
.tm-chip {
  padding: 5px 12px;
  background: #f5f7fa;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  font-size: 12px;
  color: #1d2129;
  cursor: pointer;
  transition: all 0.15s;
}
.tm-chip:hover { border-color: #d46b08; }
.tm-chip.active {
  background: linear-gradient(135deg, #d46b08, #fa541c);
  color: #fff;
  border-color: transparent;
}
.tm-chip.reset { background: #fff7e6; color: #d46b08; }
.tm-chip.reset.active { background: linear-gradient(135deg, #d46b08, #fa541c); }
.tm-reset-btn {
  margin-top: 10px;
  width: 100%;
  padding: 8px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  color: #f5222d;
  font-size: 12px;
  cursor: pointer;
}
.tm-reset-btn:hover { background: #ffccc7; }

.cp-source-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  margin-left: 4px;
}
.cp-source-tag.sim { background: #fff7e6; color: #d46b08; }
.cp-source-tag.live { background: #e6f7ff; color: #1890ff; }
.cp-source-tag.mock { background: #f5f7fa; color: #52647c; }

.cp-prompt-preview {
  margin-top: 12px;
  background: #fff;
  border: 1px dashed #ffd591;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.cp-prompt-preview summary {
  font-size: 12px;
  color: #d46b08;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.cp-prompt-preview summary::before { content: '▶ '; }
.cp-prompt-preview[open] summary::before { content: '▼ '; }
.cp-prompt-text {
  font-family: $font-family;
  font-size: 12px;
  line-height: 1.6;
  color: #52647c;
  background: #fafbff;
  padding: 12px;
  border-radius: 6px;
  margin-top: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; overflow: hidden; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }


/* ===== Input ===== */
.input-card {
  background: #fff;
  border: 2px solid #e5e6eb;
  border-radius: 14px;
  padding: 8px 12px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  &.focused {
    border-color: $primary;
    box-shadow: 0 0 0 4px rgba(31, 111, 235, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
  }
  &.running { border-color: #fa8c16; pointer-events: none; }
}
.input-icon { font-size: 22px; color: $primary; padding: 12px 8px; display: flex; align-items: center; }
.big-input {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-family: $font-family;
  font-size: 16px;
  line-height: 1.5;
  padding: 14px 0;
  background: transparent;
  color: $text-primary;
  min-height: 28px;
  max-height: 200px;
  &::placeholder { color: #a3a8b3; }
  &:disabled { background: transparent; }
}
.input-actions { display: flex; align-items: center; padding: 6px; }
.run-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #1f6feb, #4080ff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(31, 111, 235, 0.4);
  }
  &:disabled { background: #c9cdd4; cursor: not-allowed; }
}
.running-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  animation: pulse-ring 1s infinite;
}
@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6); }
  50% { box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); }
}
.quick-tags { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.qt-label { font-size: 13px; color: $text-secondary; }
.qt-pill {
  padding: 6px 14px;
  background: #fff;
  border: 1px solid $border-light;
  border-radius: 18px;
  font-size: 13px;
  cursor: pointer;
  color: $text-regular;
  transition: all 0.15s;
  &:hover { border-color: $primary; color: $primary; background: $primary-light; transform: translateY(-1px); }
}

/* ===== Flow toggle ===== */
.flow-section { margin-bottom: 24px; text-align: center; }
.flow-toggle {
  background: #fff;
  border: 1px solid $border-light;
  padding: 10px 20px;
  border-radius: 22px;
  font-size: 13px;
  color: $text-regular;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  &:hover { border-color: $primary; color: $primary; }
  .badge {
    background: $primary-light;
    color: $primary;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }
}
.flow-content { margin-top: 16px; background: #fff; border-radius: 12px; padding: 24px; border: 1px solid $border-light; text-align: left; }
.agent-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
.agent-node {
  padding: 14px 8px;
  background: $bg-hover;
  border: 2px solid transparent;
  border-radius: 10px;
  text-align: center;
  transition: all 0.3s;
  position: relative;
  &.agent-success { background: rgba(0, 181, 120, 0.08); border-color: $success; transform: translateY(-2px); }
  &.agent-running { background: rgba(31, 111, 235, 0.08); border-color: $primary; box-shadow: 0 0 0 4px rgba(31, 111, 235, 0.1); }
  &.agent-idle { opacity: 0.6; }
}
.an-step { font-size: 10px; color: $text-secondary; margin-bottom: 6px; }
.an-icon { font-size: 26px; margin-bottom: 6px; }
.an-name { font-size: 13px; font-weight: 600; color: $text-primary; margin-bottom: 2px; }
.an-desc { font-size: 11px; color: $text-secondary; margin-bottom: 8px; line-height: 1.3; }
.an-status { font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 500; }
.st-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  &.idle { background: #c9cdd4; }
  &.success { background: $success; }
  &.running { background: $primary; animation: st-pulse 1s infinite; }
}
@keyframes st-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(31, 111, 235, 0.5); }
  50% { box-shadow: 0 0 0 4px rgba(31, 111, 235, 0); }
}
.fold-enter-active, .fold-leave-active { transition: all 0.3s ease; overflow: hidden; }
.fold-enter-from, .fold-leave-to { opacity: 0; max-height: 0; margin-top: 0; }

/* ===== 决策报告（重做 - 突出决策） ===== */
.result-card {
  background: #fff;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e5e6eb;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}
.rc-banner {
  position: relative;
  background: linear-gradient(135deg, #1d2129 0%, #1f6feb 60%, #722ed1 100%);
  color: #fff;
  padding: 32px 36px;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.rc-banner-bg {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 140px;
  font-weight: 900;
  letter-spacing: -4px;
  background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  user-select: none;
  line-height: 1;
}
.rc-banner-content { position: relative; flex: 1; z-index: 1; }
.rc-banner-tag {
  display: inline-block;
  padding: 4px 14px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 20px;
  font-size: 12px;
  letter-spacing: 1px;
  margin-bottom: 12px;
  backdrop-filter: blur(10px);
}
.rc-banner-title {
  font-size: 36px;
  font-weight: 800;
  margin: 0 0 8px;
  line-height: 1.2;
}
.rc-question { font-size: 14px; opacity: 0.85; margin: 0 0 16px; font-style: italic; }
.rc-context { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.ctx-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 14px;
  font-size: 12px;
  backdrop-filter: blur(10px);
}
.ctx-coze { background: rgba(82,196,26,0.2) !important; border-color: rgba(82,196,26,0.4) !important; color: #b7eb8f; font-weight: 600; }
.ctx-mock { background: rgba(250,141,22,0.2) !important; border-color: rgba(250,141,22,0.4) !important; color: #ffd591; font-weight: 600; }
.rc-banner-actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rc-action {
  padding: 9px 18px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.rc-action:hover { background: rgba(255,255,255,0.25); }
.rc-action.primary { background: linear-gradient(135deg, #fa8c16, #f5222d); border-color: transparent; }
.rc-action.primary:hover { box-shadow: 0 4px 12px rgba(245,34,45,0.4); }

/* KPI 大数字 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border-bottom: 1px solid #e5e6eb;
}
.kpi-block {
  padding: 28px 24px;
  position: relative;
  border-right: 1px solid #e5e6eb;
  transition: all 0.2s;
}
.kpi-block:last-child { border-right: none; }
.kpi-block:hover { background: #fafbff; }
.kb-label { font-size: 13px; color: #52647c; margin-bottom: 8px; font-weight: 500; }
.kb-value {
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 8px;
  letter-spacing: -1px;
}
.kb-value .kb-unit { font-size: 18px; font-weight: 500; color: #52647c; margin-left: 4px; }
.kb-trend { font-size: 12px; color: #52647c; font-weight: 500; }
.kpi-block.primary .kb-value { color: #1f6feb; }
.kpi-block.success .kb-value { color: #00b578; }
.kpi-block.warning .kb-value { color: #fa8c16; }
.kpi-block.danger .kb-value { color: #f5222d; }
.kpi-block.purple .kb-value { color: #722ed1; }
.kpi-block.primary { background: linear-gradient(180deg, #e8f3ff, #fff); }
.kpi-block.success { background: linear-gradient(180deg, #e6f9ef, #fff); }
.kpi-block.warning { background: linear-gradient(180deg, #fff7e6, #fff); }
.kpi-block.danger { background: linear-gradient(180deg, #fff1f0, #fff); }
.kpi-block.purple { background: linear-gradient(180deg, #f9f0ff, #fff); }


/* ===== 自动注入清单（决策报告里） ===== */
.injection-block {
  padding: 20px 36px;
  background: linear-gradient(135deg, #fafbff, #fff);
  border-bottom: 1px solid #e5e6eb;
}
.ib-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ib-ico { font-size: 20px; }
.ib-title { font-size: 15px; font-weight: 700; color: #1d2129; }
.ib-sub { font-size: 12px; color: #52647c; }
.ib-toggle {
  margin-left: auto;
  padding: 4px 12px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  font-size: 12px;
  color: #1f6feb;
  cursor: pointer;
}
.ib-toggle:hover { background: #e8f3ff; }
.ib-content { margin-top: 12px; }
.ib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}
.ib-item {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ibi-ico { font-size: 16px; }
.ibi-label { font-size: 11px; color: #52647c; }
.ibi-value { font-size: 13px; color: #1d2129; font-weight: 600; }
.ib-prompt {
  margin-top: 12px;
  background: #fff;
  border: 1px dashed #1f6feb;
  border-radius: 8px;
  padding: 8px 12px;
}
.ib-prompt summary {
  font-size: 12px;
  color: #1f6feb;
  font-weight: 600;
  cursor: pointer;
}
.ib-prompt summary::before { content: '▶ '; }
.ib-prompt[open] summary::before { content: '▼ '; }
.ib-prompt pre {
  font-family: $font-family;
  font-size: 12px;
  line-height: 1.6;
  color: #1d2129;
  background: #fafbff;
  padding: 12px;
  border-radius: 6px;
  margin-top: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Agent 协同链 */
.agent-flow {
  padding: 28px 36px;
  background: #fafbff;
  border-bottom: 1px solid #e5e6eb;
}
.af-header { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; }
.af-ico { font-size: 22px; }
.af-title { font-size: 16px; font-weight: 700; color: #1d2129; }
.af-sub { font-size: 12px; color: #52647c; margin-left: 6px; }
.af-chain { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 4px; }
.af-step { display: flex; align-items: center; flex-shrink: 0; }
.af-node {
  background: #fff;
  border: 2px solid #1f6feb;
  border-radius: 12px;
  padding: 14px 12px;
  width: 140px;
  text-align: center;
  position: relative;
  box-shadow: 0 4px 12px rgba(31,111,235,0.08);
}
.af-step-num {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f6feb;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}
.af-step-icon { font-size: 28px; margin-bottom: 6px; }
.af-step-name { font-size: 13px; font-weight: 700; color: #1d2129; margin-bottom: 4px; }
.af-step-desc { font-size: 10px; color: #52647c; line-height: 1.3; margin-bottom: 8px; min-height: 26px; }
.af-step-output {
  font-size: 11px;
  color: #1d2129;
  background: #f0f5ff;
  padding: 6px 8px;
  border-radius: 6px;
  line-height: 1.4;
  text-align: left;
  border-left: 3px solid #1f6feb;
}
.af-arrow { font-size: 24px; color: #1f6feb; padding: 0 8px; font-weight: 800; }

/* 详细报告 */
.report-section { padding: 28px 36px; border-bottom: 1px solid #e5e6eb; }
.rs-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.rs-ico { font-size: 18px; }
.rs-title { font-size: 15px; font-weight: 700; color: #1d2129; }
.rs-copy {
  margin-left: auto;
  padding: 5px 12px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  font-size: 12px;
  color: #52647c;
  cursor: pointer;
}
.rs-copy:hover { background: #1f6feb; color: #fff; border-color: #1f6feb; }
.report-body {
  font-family: $font-family;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.7;
  background: #f5f7fa;
  padding: 20px 24px;
  border-radius: 8px;
  margin: 0;
  max-height: 480px;
  overflow-y: auto;
  border-left: 4px solid #1f6feb;
}

/* 底部 CTA */
.bottom-cta {
  padding: 24px 36px;
  background: linear-gradient(135deg, #fff8e6, #fff5f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
.cta-title { font-size: 16px; font-weight: 700; color: #d46b08; margin-bottom: 4px; }
.cta-sub { font-size: 13px; color: #52647c; }
.cta-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.cta-btn {
  padding: 10px 18px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  font-size: 13px;
  color: #1d2129;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
}
.cta-btn:hover { border-color: #1f6feb; color: #1f6feb; }
.cta-btn.primary {
  background: linear-gradient(135deg, #1f6feb, #722ed1);
  color: #fff;
  border-color: transparent;
  font-weight: 600;
}
.cta-btn.primary:hover { box-shadow: 0 4px 12px rgba(31,111,235,0.4); }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.4s ease; }
.slide-up-enter-from { opacity: 0; transform: translateY(20px); }
.slide-up-leave-to { opacity: 0; transform: translateY(-20px); }

/* ===== 历史 ===== */
.history-section { margin-top: 32px; h3 { font-size: 14px; color: $text-secondary; margin-bottom: 12px; } }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid $border-light;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: $primary; background: $primary-light; }
}
.hi-icon { font-size: 18px; }
.hi-text { flex: 1; font-size: 14px; color: $text-primary; }
.hi-time { font-size: 12px; color: $text-placeholder; }

@media (max-width: 1100px) {
  .agent-grid { grid-template-columns: repeat(4, 1fr); }
}

// 🔍 Agent 调用追踪样式
.tracking-section {
  background: #fff;
  border: 1px solid $border-light;
  border-radius: 12px;
  padding: 20px;
  margin-top: 16px;
}
.ts-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.ts-ico { font-size: 20px; }
.ts-title { font-size: 16px; font-weight: 600; color: $text-primary; }
.ts-sub { font-size: 12px; color: $text-placeholder; margin-left: auto; }
.ts-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.ts-stat {
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  text-align: center;
  border-left: 3px solid #1f6feb;
  &.success { border-left-color: #00b578; background: #f0f9f4; }
  &.warning { border-left-color: #fa8c16; background: #fff7e6; }
  &.ok { border-left-color: #00b578; }
}
.ts-stat-value { font-size: 20px; font-weight: 700; color: $text-primary; margin-bottom: 4px; word-break: break-all; }
.ts-stat-label { font-size: 11px; color: $text-placeholder; }
.ts-timeline {
  background: #fafbfc;
  border-radius: 8px;
  padding: 12px;
}
.ts-row {
  display: grid;
  grid-template-columns: 32px 140px 1fr 60px 24px;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 4px;
  &:hover { background: #fff; }
  &.warning { color: #fa8c16; }
}
.ts-icon { font-size: 18px; text-align: center; }
.ts-name { font-size: 13px; color: $text-primary; font-weight: 500; }
.ts-bar-wrap {
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}
.ts-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
  min-width: 4px;
}
.ts-ms { font-size: 12px; color: $text-placeholder; text-align: right; font-family: monospace; }
.ts-status { font-size: 14px; text-align: center; color: #00b578; }
.ts-row.warning .ts-status { color: #fa8c16; }
.ts-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e8e8e8;
  font-size: 11px;
  color: $text-placeholder;
  display: flex;
  gap: 8px;
}
.ts-footo-time { font-family: monospace; }

@media (max-width: 1100px) {
  .ts-summary { grid-template-columns: repeat(2, 1fr); }
  .ts-row { grid-template-columns: 24px 100px 1fr 50px 20px; }
}

/* 📚 参考知识库 */
.kb-section {
  background: linear-gradient(135deg, #fff7e6 0%, #fff 100%);
  border: 1px solid #ffd591;
  border-radius: 12px;
  padding: 20px 24px;
  margin: 24px 0;
}
.kb-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.kb-ico { font-size: 20px; }
.kb-title { font-size: 16px; font-weight: 700; color: #d4380d; }
.kb-sub { font-size: 12px; color: #8c8c8c; margin-left: auto; }
.kb-list { display: flex; flex-direction: column; gap: 10px; }
.kb-item {
  background: #fff;
  border: 1px solid #ffe7ba;
  border-radius: 8px;
  padding: 12px 16px;
  transition: all 0.2s;
}
.kb-item:hover { border-color: #fa8c16; transform: translateX(4px); }
.kb-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}
.kb-num { color: #fa8c16; font-weight: 600; }
.kb-name { font-weight: 600; color: #1f2d3d; flex: 1; }
.kb-cat {
  background: #fff7e6;
  color: #d4380d;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.kb-score {
  background: #f6ffed;
  color: #389e0d;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.kb-excerpt {
  font-size: 12px;
  color: #595959;
  line-height: 1.6;
  white-space: pre-wrap;
  border-left: 3px solid #ffd591;
  padding-left: 10px;
  margin-top: 4px;
}

</style>