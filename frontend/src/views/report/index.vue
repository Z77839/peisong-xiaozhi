<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useCityStore } from '@/store/city'
import { formatNumber } from '@/utils/format'
import request from '@/api/request'

const cityStore = useCityStore()
const city = cityStore.currentCity

const reportTypes = ref([
  { key: 'daily', label: '运营日报', icon: '📊', desc: '今日数据汇总' },
  { key: 'weekly', label: '运营周报', icon: '📈', desc: '本周趋势分析' },
  { key: 'monthly', label: '运营月报', icon: '📋', desc: '月度复盘' },
  { key: 'incident', label: '事件复盘', icon: '🔥', desc: '异常事件分析' }
])

const currentType = ref('daily')
const generating = ref(false)
const generatedReports = ref<any[]>([])
const previewContent = ref('')
const selectedReport = ref<any>(null)
const queryInput = ref('分析衡阳晚高峰运力情况，给出成本优化建议')
const loading = ref(false)

// 加载历史报告列表（从后端 history 端点）
async function fetchHistory() {
  try {
    const r: any = await request({ url: '/decision/history' })
    const list = r.data || r || []
    generatedReports.value = list.map((h: any, i: number) => ({
      id: h.id || String(i),
      title: h.text || h.title || '运营报告',
      time: h.time || Date.now() - i * 86400000,
      status: h.status || 'success',
      type: currentType.value,
      model: h.model || 'doubao'
    }))
    if (generatedReports.value.length > 0) {
      selectedReport.value = generatedReports.value[0]
    }
  } catch (e) {
    console.warn('加载历史报告失败', e)
  }
}

onMounted(() => {
  fetchHistory()
})

// 生成报告（调用决策中心）
async function generate() {
  generating.value = true
  try {
    const r: any = await request({
      url: '/decision/run',
      method: 'POST',
      data: {
        query: queryInput.value,
        cityId: city.id
      }
    })
    const data = r.data || r
    previewContent.value = data.report || '生成失败'
    selectedReport.value = {
      id: `r_${Date.now()}`,
      title: queryInput.value,
      time: Date.now(),
      status: 'success',
      type: currentType.value,
      model: data.model || 'doubao',
      context: data.context,
      steps: data.steps,
      provider: data.provider
    }
    // 添加到列表头部
    generatedReports.value.unshift(selectedReport.value)
    ElMessage.success('报告已生成（豆包 LLM）')
  } catch (e: any) {
    ElMessage.error('生成失败: ' + (e.message || '未知错误'))
  } finally {
    generating.value = false
  }
}

const selectReport = (r: any) => {
  selectedReport.value = r
  previewContent.value = r.content || '(点击"生成报告"查看详情)'
}

const downloadReport = () => {
  if (!previewContent.value) {
    ElMessage.warning('请先生成报告')
    return
  }
  const blob = new Blob([previewContent.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('报告已下载')
}

const formatTime = (ts: number) => {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="page-container">
    <!-- 报告类型选择 -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">📄 报告类型</span>
      </div>
      <div class="type-grid">
        <div
          v-for="t in reportTypes"
          :key="t.key"
          class="type-card"
          :class="{ active: currentType === t.key }"
          @click="currentType = t.key"
        >
          <div class="type-icon">{{ t.icon }}</div>
          <div class="type-name">{{ t.label }}</div>
          <div class="type-desc">{{ t.desc }}</div>
        </div>
      </div>
    </div>

    <div class="row mt-16">
      <!-- 报告列表 -->
      <div class="card" style="width: 320px; flex-shrink: 0;">
        <div class="card-head">
          <span class="card-title">历史报告</span>
          <el-button size="small" @click="fetchHistory">刷新</el-button>
        </div>
        <div v-loading="loading" class="report-list">
          <div
            v-for="r in generatedReports"
            :key="r.id"
            class="report-item"
            :class="{ active: selectedReport?.id === r.id }"
            @click="selectReport(r)"
          >
            <div class="ri-title">{{ r.title }}</div>
            <div class="ri-meta">
              <el-tag size="small" :type="r.model === 'doubao' ? 'success' : 'info'">{{ r.model }}</el-tag>
              <span class="ri-time">{{ formatTime(r.time) }}</span>
            </div>
          </div>
          <div v-if="!loading && generatedReports.length === 0" class="empty">
            暂无报告，点击「生成报告」开始
          </div>
        </div>
      </div>

      <!-- 生成 + 预览 -->
      <div class="card flex-card">
        <div class="card-head">
          <span class="card-title">{{ currentType === 'incident' ? '事件复盘' : currentType === 'daily' ? '运营日报' : currentType === 'weekly' ? '运营周报' : '运营月报' }}</span>
          <div class="head-actions">
            <el-button size="small" :loading="generating" type="primary" @click="generate">
              <el-icon><MagicStick /></el-icon>
              {{ generating ? '生成中...' : '生成报告（豆包 LLM）' }}
            </el-button>
            <el-button size="small" @click="downloadReport">下载</el-button>
          </div>
        </div>
        <el-input
          v-model="queryInput"
          type="textarea"
          :rows="2"
          placeholder="输入您想分析的问题，例如：分析衡阳晚高峰运力情况，给出成本优化建议"
          style="margin-bottom: 12px"
        />
        <div v-if="selectedReport" class="report-detail">
          <!-- Context 信息 -->
          <div v-if="selectedReport.context" class="ctx-banner">
            <div class="ctx-item">
              <span class="ctx-label">📅 时间：</span>
              <span class="ctx-value">{{ selectedReport.context.datetime }}</span>
            </div>
            <div class="ctx-item">
              <span class="ctx-label">🌤️ 天气：</span>
              <span class="ctx-value">{{ selectedReport.context.weather?.label }} {{ selectedReport.context.weather?.temp }}°C</span>
            </div>
            <div class="ctx-item">
              <span class="ctx-label">🕐 时段：</span>
              <span class="ctx-value">{{ selectedReport.context.timeSlot?.name }}</span>
            </div>
            <div class="ctx-item" v-if="selectedReport.context.riders">
              <span class="ctx-label">🚴 骑手：</span>
              <span class="ctx-value">{{ formatNumber(selectedReport.context.riders.total) }} 人（{{ selectedReport.context.riders.cityCount }} 衡阳）</span>
            </div>
          </div>

          <!-- Agent 步骤 -->
          <div v-if="selectedReport.steps" class="steps-list">
            <div v-for="(s, i) in selectedReport.steps" :key="i" class="step-item">
              <span class="step-icon">{{ s.icon }}</span>
              <span class="step-name">{{ s.name }}</span>
              <span class="step-status">✓</span>
            </div>
          </div>

          <!-- 报告内容 -->
          <pre v-if="previewContent" class="report-content">{{ previewContent }}</pre>
          <div v-else class="placeholder">
            <el-icon size="48" color="#909399"><Document /></el-icon>
            <p>选择左侧历史报告查看，或点击「生成报告」创建新报告</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

.page-container { padding: 20px; }

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title { font-size: 16px; font-weight: 600; color: #1f2d3d; }

.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.type-card {
  padding: 20px 16px;
  border: 2px solid #f0f0f0;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #1f6feb;
    background: #f0f7ff;
  }
  
  &.active {
    border-color: #1f6feb;
    background: #e8f1ff;
  }
}

.type-icon { font-size: 32px; margin-bottom: 8px; }
.type-name { font-size: 14px; font-weight: 600; color: #1f2d3d; }
.type-desc { font-size: 12px; color: #909399; margin-top: 4px; }

.row { display: flex; gap: 16px; }
.mt-16 { margin-top: 16px; }
.flex-card { flex: 1; }

.head-actions { display: flex; gap: 8px; }

.report-list {
  max-height: 600px;
  overflow-y: auto;
}

.report-item {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #f0f7ff;
    border-color: #1f6feb;
  }
  
  &.active {
    background: #e8f1ff;
    border-color: #1f6feb;
  }
}

.ri-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2d3d;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ri-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #909399;
}

.ri-time { font-size: 11px; color: #909399; }

.empty {
  text-align: center;
  padding: 40px 0;
  color: #909399;
  font-size: 13px;
}

.ctx-banner {
  background: linear-gradient(90deg, rgba(31, 111, 235, 0.05), rgba(0, 181, 120, 0.05));
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.ctx-item { font-size: 12px; }
.ctx-label { color: #909399; }
.ctx-value { color: #1f2d3d; font-weight: 500; }

.steps-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.step-item {
  background: #f0f7ff;
  border: 1px solid #d0e0ff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  color: #1f6feb;
  display: flex;
  align-items: center;
  gap: 4px;
}

.step-icon { font-size: 14px; }

.step-status { color: #00b578; }

.report-content {
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 16px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.8;
  color: #1f2d3d;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 500px;
  overflow-y: auto;
}

.placeholder {
  text-align: center;
  padding: 60px 0;
  color: #909399;
  
  p { margin-top: 12px; font-size: 14px; }
}
</style>
