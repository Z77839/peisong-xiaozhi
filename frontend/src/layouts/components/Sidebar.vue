<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/store/app'

const route = useRoute()
const appStore = useAppStore()

const menus = [
  { path: '/dashboard', title: '运营总览', icon: 'DataAnalysis' },
  { path: '/decision', title: '决策中心', icon: 'Cpu' },
  { path: '/alert', title: '预警中心', icon: 'Warning' },
  { path: '/dispatch', title: '智能派单', icon: 'TakeawayBox' },
  { path: '/simulation', title: '仿真回放', icon: 'VideoPlay' },
  { path: '/rider-types', title: '运力线分析', icon: 'Van' },
  { path: '/rider', title: '骑手管理', icon: 'User' },
  { path: '/order', title: '订单分析', icon: 'TrendCharts' },
  { path: '/cost', title: '成本分析', icon: 'Money' },
  { path: '/merchant', title: '商户健康度', icon: 'Shop' },
  { path: '/c-end', title: 'C 端运营', icon: 'ChatLineSquare' },
  { path: '/report', title: '运营报告', icon: 'Document' },
  { path: '/knowledge', title: '知识库', icon: 'Files' },
  { path: '/setting', title: '系统设置', icon: 'Setting' }
]

const activeMenu = computed(() => route.path)
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
    <div class="sidebar-logo">
      <div class="logo-icon">
        <svg viewBox="0 0 32 32" width="28" height="28">
          <defs>
            <linearGradient id="sl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#4080ff"/>
              <stop offset="100%" stop-color="#1f6feb"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="6" fill="url(#sl)"/>
          <text x="16" y="22" text-anchor="middle" fill="#fff" font-size="16" font-weight="700" font-family="sans-serif">九</text>
        </svg>
      </div>
      <div v-show="!appStore.sidebarCollapsed" class="logo-text">
        <div class="logo-title">配送小智</div>
        <div class="logo-sub">AI 运营决策平台</div>
      </div>
    </div>

    <el-menu
      :default-active="activeMenu"
      class="sidebar-menu"
      background-color="transparent"
      text-color="#cbd5e1"
      active-text-color="#fff"
      :collapse="appStore.sidebarCollapsed"
      :collapse-transition="false"
      router
    >
      <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
        <el-icon><component :is="m.icon" /></el-icon>
        <template #title>{{ m.title }}</template>
      </el-menu-item>
    </el-menu>

    <div v-show="!appStore.sidebarCollapsed" class="sidebar-footer">
      <div class="version">v 2.6.1 · 演示版</div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
