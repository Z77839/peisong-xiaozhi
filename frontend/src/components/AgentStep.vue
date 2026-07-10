<script setup lang="ts">
import type { AgentStep } from '@/api/coze'

interface Props {
  step: AgentStep
}
const props = defineProps<Props>()

const statusText = (s: AgentStep['status']) => {
  switch (s) {
    case 'pending': return '待执行'
    case 'running': return '运行中'
    case 'success': return '已完成'
    case 'error': return '失败'
    default: return s
  }
}
</script>

<template>
  <div class="agent-step" :class="`is-${props.step.status}`">
    <div class="step-icon">
      <el-icon v-if="props.step.status === 'running'" class="rotating"><Loading /></el-icon>
      <el-icon v-else-if="props.step.status === 'success'"><CircleCheckFilled /></el-icon>
      <el-icon v-else-if="props.step.status === 'error'"><CircleCloseFilled /></el-icon>
      <el-icon v-else><Clock /></el-icon>
    </div>
    <div class="step-content">
      <div class="step-name">{{ props.step.name }}</div>
      <div class="step-status">{{ statusText(props.step.status) }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
