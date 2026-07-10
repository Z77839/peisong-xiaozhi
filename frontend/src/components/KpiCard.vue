<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  unit?: string
  trend?: number
  icon?: string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: '#1f6feb'
})

const trendUp = () => (props.trend ?? 0) > 0
const trendDown = () => (props.trend ?? 0) < 0
</script>

<template>
  <div class="kpi-card">
    <div class="kpi-head">
      <span class="kpi-label">{{ label }}</span>
      <div class="kpi-icon" :style="{ background: `${color}15`, color }">
        <el-icon v-if="icon" :size="18"><component :is="icon" /></el-icon>
      </div>
    </div>
    <div class="kpi-value">
      <span class="value">{{ value }}</span>
      <span v-if="unit" class="unit">{{ unit }}</span>
    </div>
    <div v-if="trend !== undefined" class="kpi-trend">
      <span :class="['trend-tag', trendUp() ? 'up' : trendDown() ? 'down' : 'flat']">
        <el-icon><component :is="trendUp() ? 'CaretTop' : trendDown() ? 'CaretBottom' : 'Minus'" /></el-icon>
        {{ Math.abs(trend) }}%
      </span>
      <span class="trend-text">较昨日</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
