<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
import AppHeader from './components/AppHeader.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import ChatBot from '@/components/ChatBot.vue'
</script>

<template>
  <div class="main-layout">
    <Sidebar />
    <div class="main-content">
      <AppHeader />
      <div class="main-breadcrumb">
        <Breadcrumb />
      </div>
      <div class="main-body">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
    <!-- 全局悬浮 AI 助手 -->
    <ChatBot />
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;
.main-layout {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: $bg-body;
}

.main-breadcrumb {
  padding: 12px 24px 0;
  background: $bg-body;
}

.main-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
