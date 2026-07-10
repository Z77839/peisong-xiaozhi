<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const reportTypes = ref([
  { key: 'daily', label: '日报', icon: '📊', desc: '今日运营数据汇总' },
  { key: 'weekly', label: '周报', icon: '📈', desc: '本周趋势分析' },
  { key: 'monthly', label: '月报', icon: '📋', desc: '月度复盘报告' },
  { key: 'custom', label: '自定义', icon: '⚙️', desc: '按需生成' }
])

const currentType = ref('daily')
const generating = ref(false)
const generatedReports = ref([
  { id: '1', title: '2024-07-06 运营日报', date: '2024-07-06', size: '2.3 MB', format: 'PDF' },
  { id: '2', title: '2024-07-05 运营日报', date: '2024-07-05', size: '2.1 MB', format: 'PDF' },
  { id: '3', title: '2024 年 6 月月报', date: '2024-06-30', size: '8.6 MB', format: 'PDF' },
  { id: '4', title: '2024 年第 26 周周报', date: '2024-06-30', size: '4.2 MB', format: 'PDF' }
])

const generate = () => {
  generating.value = true
  setTimeout(() => {
    generating.value = false
    generatedReports.value.unshift({
      id: String(Date.now()),
      title: `2024-07-07 运营日报（AI 生成）`,
      date: '2024-07-07',
      size: '2.4 MB',
      format: 'PDF'
    })
    ElMessage.success('报告已生成！')
  }, 2000)
}

const previewContent = ref(`📊 配送运营分析报告
━━━━━━━━━━━━━━━━━━━━━━━━━━

▍ 订单预测
预测今日订单量 12,847 单，环比 ↑ 12.3%
高峰出现在 17:30 - 19:30

▍ 运力评估
在岗骑手 462 人 / 需求 524 人
缺口 62 人，建议启动储备运力

▍ 风险等级
综合评估：低风险

▍ AI 建议
1. 增补骑手 36 人
2. 启用商户驻点
3. 临时补贴启动

▍ 预计收益
• 时效提升 +8%
• 单均成本下降 ¥1.5
• 投诉率下降 22%`)
</script>

<template>
  <div class="page-container">
    <div class="report-toolbar">
      <div class="type-tabs">
        <div
          v-for="t in reportTypes"
          :key="t.key"
          class="type-card"
          :class="{ active: currentType === t.key }"
          @click="currentType = t.key"
        >
          <div class="type-icon">{{ t.icon }}</div>
          <div>
            <div class="type-label">{{ t.label }}</div>
            <div class="type-desc">{{ t.desc }}</div>
          </div>
        </div>
      </div>
      <el-button type="primary" size="large" :loading="generating" @click="generate">
        <el-icon><MagicStick /></el-icon>
        {{ generating ? '生成中...' : '一键生成报告' }}
      </el-button>
    </div>

    <div class="row mt-16">
      <div class="card preview-card">
        <div class="card-head">
          <span class="card-title">报告预览</span>
          <div>
            <el-tag size="small" type="success">AI 实时生成</el-tag>
          </div>
        </div>
        <div class="preview-doc">
          <pre>{{ previewContent }}</pre>
        </div>
        <div class="preview-actions">
          <el-button><el-icon /><el-icon /><Download />下载 PDF</el-button>
          <el-button><el-icon /><Printer />打印</el-button>
          <el-button type="primary"><el-icon /><Promotion />推送团队</el-button>
        </div>
      </div>

      <div class="card list-card">
        <div class="card-head">
          <span class="card-title">历史报告</span>
        </div>
        <div class="report-list">
          <div v-for="r in generatedReports" :key="r.id" class="report-item">
            <div class="ri-icon">📄</div>
            <div class="ri-meta">
              <div class="ri-title">{{ r.title }}</div>
              <div class="ri-info">
                <span>{{ r.date }}</span> · <span>{{ r.size }}</span> · <span>{{ r.format }}</span>
              </div>
            </div>
            <div class="ri-actions">
              <el-button link type="primary" size="small">预览</el-button>
              <el-button link type="primary" size="small">下载</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
