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
  { path: '/data-source', title: '数据接入', icon: 'Connection' },
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
          <text x="16" y="22" text-anchor="middle" fill="#fff" font-size="16" font-weight="700" font-family="sans-serif">配</text>
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
      text-color="#1a1a2e"
      active-text-color="#1f6feb"
      active-background-color="#e8f1ff"
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
      <div class="version">v 15.5 · 演示版</div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

.sidebar {
  background: #fff;
  border-right: 1px solid #e8e8e8;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: $sidebar-width;
  transition: width 0.3s;

  &.collapsed {
    width: $sidebar-collapsed-width;
  }
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  height: 60px;
  flex-shrink: 0;
}

.logo-icon {
  flex-shrink: 0;
}

.logo-text {
  .logo-title {
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.2;
  }
  .logo-sub {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }
}

.sidebar-menu {
  flex: 1;
  border-right: none !important;
  padding: 8px 0;
  overflow-y: auto;

  :deep(.el-menu-item) {
    color: #1a1a2e !important;
    font-size: 14px;
    height: 44px;
    line-height: 44px;
    margin: 2px 8px;
    border-radius: 6px;
    padding: 0 12px !important;

    &:hover {
      background: #f0f7ff !important;
      color: #1f6feb !important;
    }

    &.is-active {
      background: #e8f1ff !important;
      color: #1f6feb !important;
      font-weight: 600;

      .el-icon {
        color: #1f6feb !important;
      }
    }

    .el-icon {
      color: #666;
      font-size: 16px;
      margin-right: 8px;
    }
  }
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
  .version {
    font-size: 11px;
    color: #999;
    text-align: center;
  }
}
</style>
