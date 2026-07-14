<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const title = computed(() => (route.meta?.title as string) || '首页')

const subtitle = computed(() => {
  const map: Record<string, string> = {
    Dashboard: '实时洞察配送运营全局指标',
    Chat: '用自然语言调用多 Agent 协同决策',
    Order: 'AI 模型预测各时段订单量与趋势',
    Rider: '运力调度与人效评估',
    Cost: '成本结构拆解与优化建议',
    Decision: '多 Agent 协同执行与决策流',
    Report: '一键生成专业运营报告',
    Knowledge: '运营知识库与文档管理',
    Setting: '系统参数与权限配置'
  }
  return map[route.name as string] || ''
})
</script>

<template>
  <div class="breadcrumb">
    <h2 class="page-title">{{ title }}</h2>
    <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
