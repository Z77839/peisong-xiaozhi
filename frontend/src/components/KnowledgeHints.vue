<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import request from '@/api/request'

const route = useRoute()
const hints = ref<any[]>([])
const loading = ref(false)
const expanded = ref(true)

// 根据当前页面生成检索关键词
const keywordsByRoute: Record<string, string[]> = {
  '/alert': ['运力缺口', '高峰补贴', '运力预判', '运力调度', '跨区调拨', '蜂跑', '众包'],
  '/decision': ['运力', '成本', '高峰', '补贴', '调度', '派单'],
  '/dispatch': ['派单', '骑手', '调度', '评分', '距离', '运力'],
  '/cost': ['成本', '运力', '运力线', '调度', 'Pareto'],
  '/order': ['订单', '预测', '高峰', '时段'],
  '/rider': ['骑手', '生命周期', '等级', '服务分', 'KOL'],
  '/simulation': ['仿真', '预案', '应急', '历史'],
  '/dashboard': ['运力', '订单', '高峰', '缺口'],
  '/data-source': ['Adapter', '数据接入', '授权'],
  '/knowledge': ['知识库', 'SOP', '规范', '手册'],
  '/readiness': ['安全', '生产', '稳定', '监控'],
  '/report': ['报告', '总结', '复盘', 'AI']
}

async function fetchHints() {
  const path = route.path
  const kws = keywordsByRoute[path] || ['运力', '订单', '成本', '高峰']
  loading.value = true
  try {
    // 并发检索多个关键词
    const results = await Promise.all(
      kws.slice(0, 3).map(q =>
        request({ url: `/knowledge/search?q=${encodeURIComponent(q)}&limit=2` }).catch(() => [])
      )
    )
    // 去重（axios 拦截器已剥离 code，r 直接是数组）
    const seen = new Set<string>()
    const merged: any[] = []
    for (const r of results) {
      const arr = Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : [])
      for (const item of arr) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          merged.push(item)
        }
      }
    }
    hints.value = merged.slice(0, 3)
  } catch (e) {
    console.warn('知识库提示加载失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchHints())

function viewDoc(doc: any) {
  // 跳转到知识库页 + hash
  const url = `#/knowledge?focusId=${doc.id}`
  window.location.hash = url.slice(1)
}
</script>

<template>
  <div v-if="hints.length > 0" class="kh-container">
    <div class="kh-header" @click="expanded = !expanded">
      <span class="kh-icon">📚</span>
      <span class="kh-title">相关知识（来自运营知识库）</span>
      <span class="kh-count">{{ hints.length }} 条</span>
      <span class="kh-toggle">{{ expanded ? '▼' : '▶' }}</span>
    </div>
    <transition name="fade">
      <div v-if="expanded" class="kh-body">
        <div
          v-for="h in hints"
          :key="h.id"
          class="kh-item"
          @click="viewDoc(h)"
        >
          <div class="kh-item-head">
            <span class="kh-doc-icon">📄</span>
            <span class="kh-doc-title">{{ h.title }}</span>
            <el-tag size="small" type="info">{{ h.cat }}</el-tag>
            <span class="kh-score">匹配度 {{ h.score }}</span>
          </div>
          <div class="kh-excerpt">{{ h.excerpt }}</div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.kh-container {
  background: linear-gradient(90deg, rgba(155, 89, 255, 0.06), rgba(31, 111, 235, 0.04));
  border: 1px solid rgba(155, 89, 255, 0.15);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.kh-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
  background: rgba(155, 89, 255, 0.06);

  &:hover { background: rgba(155, 89, 255, 0.1); }
}

.kh-icon { font-size: 16px; }
.kh-title { font-size: 13px; font-weight: 600; color: #5b21b6; flex: 1; }
.kh-count { font-size: 11px; color: #909399; }
.kh-toggle { font-size: 12px; color: #909399; }

.kh-body {
  padding: 8px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kh-item {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover { background: #fff; }
}

.kh-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.kh-doc-icon { font-size: 14px; }
.kh-doc-title { font-size: 13px; font-weight: 600; color: #1f2d3d; flex: 1; }
.kh-score { font-size: 11px; color: #9b59ff; }

.kh-excerpt {
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
