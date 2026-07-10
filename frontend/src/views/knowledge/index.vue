<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('docs')
const search = ref('')

const docs = ref([
  { id: 1, title: '配送小智运营手册 v2.6', cat: '运营', updated: '2 小时前', views: 1284 },
  { id: 2, title: '运力调度最佳实践', cat: '调度', updated: '昨天', views: 928 },
  { id: 3, title: '恶劣天气应急预案', cat: '应急', updated: '3 天前', views: 615 },
  { id: 4, title: '商户入驻规范与审核流程', cat: '商户', updated: '1 周前', views: 482 },
  { id: 5, title: '订单预测模型说明', cat: '算法', updated: '1 周前', views: 396 }
])

const faqs = ref([
  { q: '如何调整 AI 预测模型参数？', a: '在 系统设置 → 模型配置 中调整...' },
  { q: '运力缺口如何快速响应？', a: '启用储备骑手 + 启动临时补贴...' },
  { q: '运营报告如何定时推送？', a: '在 报告中心 → 订阅设置 中配置...' }
])
</script>

<template>
  <div class="page-container">
    <div class="kb-toolbar">
      <div class="search-box">
        <el-input
          v-model="search"
          :prefix-icon="'Search'"
          placeholder="搜索知识库内容..."
          size="large"
          style="width: 400px"
        />
      </div>
      <div class="kb-actions">
        <el-button size="large" type="primary">
          <el-icon><Plus /></el-icon> 上传文档
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="kb-tabs">
      <el-tab-pane label="📚 文档库" name="docs" />
      <el-tab-pane label="❓ 常见问题" name="faqs" />
      <el-tab-pane label="🎓 培训资料" name="training" />
      <el-tab-pane label="📊 数据字典" name="dict" />
    </el-tabs>

    <div v-if="activeTab === 'docs'" class="kb-content">
      <div class="doc-grid">
        <div v-for="d in docs" :key="d.id" class="doc-card">
          <div class="doc-icon">📄</div>
          <div class="doc-meta">
            <div class="doc-title">{{ d.title }}</div>
            <el-tag size="small" effect="plain">{{ d.cat }}</el-tag>
          </div>
          <div class="doc-info">
            <span>{{ d.updated }}</span> · <span>{{ d.views }} 浏览</span>
          </div>
          <div class="doc-actions">
            <el-button link type="primary" size="small">查看</el-button>
            <el-button link type="primary" size="small">下载</el-button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'faqs'" class="kb-content">
      <el-collapse>
        <el-collapse-item v-for="(f, i) in faqs" :key="i" :title="f.q" :name="String(i)">
          <p>{{ f.a }}</p>
        </el-collapse-item>
      </el-collapse>
    </div>

    <div v-else class="kb-content">
      <el-empty description="该分类内容正在整理中..." />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
