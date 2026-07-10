<script setup lang="ts">
import type { KpiItem } from '../mock/dashboard';

defineProps<{
  items: KpiItem[];
  compact?: boolean;
}>();
</script>

<template>
  <div class="kpi-grid" :class="{ compact }">
    <article v-for="item in items" :key="item.label" class="kpi-card" :class="`tone-${item.tone}`">
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
      <small>{{ item.trend }}</small>
    </article>
  </div>
</template>
