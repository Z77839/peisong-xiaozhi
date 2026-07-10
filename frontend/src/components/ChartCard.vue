<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  height?: string | number
}
withDefaults(defineProps<Props>(), { height: '320px' })
</script>

<template>
  <div class="chart-card">
    <div class="chart-head">
      <div>
        <div class="chart-title">{{ title }}</div>
        <div v-if="subtitle" class="chart-subtitle">{{ subtitle }}</div>
      </div>
      <div class="chart-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="chart-body" :style="{ height: typeof height === 'number' ? `${height}px` : height }">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
