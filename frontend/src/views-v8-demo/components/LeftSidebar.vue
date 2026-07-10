<script setup lang="ts">
import type { ChatSession } from '../mock/dashboard';

export type MenuKey =
  | 'new-chat'
  | 'operation-qa'
  | 'capacity-prediction'
  | 'dispatch-assist'
  | 'cost-analysis'
  | 'history'
  | 'data-files';

defineProps<{
  collapsed: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeMenu: MenuKey;
}>();

defineEmits<{
  toggle: [];
  menuClick: [menu: MenuKey];
  selectSession: [id: string];
}>();

const menuItems: Array<{ key: MenuKey; label: string }> = [
  { key: 'new-chat', label: '新对话' },
  { key: 'operation-qa', label: '运营问答' },
  { key: 'capacity-prediction', label: '运力预测' },
  { key: 'dispatch-assist', label: '派单辅助' },
  { key: 'cost-analysis', label: '成本分析' },
  { key: 'history', label: '历史记录' },
  { key: 'data-files', label: '数据文件' },
];
</script>

<template>
  <aside class="left-sidebar" :class="{ collapsed }">
    <div class="sidebar-top">
      <button class="icon-button" type="button" title="展开/收起" @click="$emit('toggle')">
        {{ collapsed ? '☰' : '‹' }}
      </button>
      <div class="brand sidebar-content">
        <span class="brand-mark">AI</span>
        <strong>AI 配送运营助手</strong>
      </div>
    </div>

    <nav class="main-menu">
      <button
        v-for="item in menuItems"
        :key="item.key"
        type="button"
        :class="{ primary: activeMenu === item.key }"
        @click="$emit('menuClick', item.key)"
      >
        <span class="menu-dot"></span>
        <span class="menu-label sidebar-content">{{ item.label }}</span>
      </button>
    </nav>

    <div class="history-block sidebar-content">
      <div class="history-title">历史聊天</div>
      <button
        v-for="session in sessions"
        :key="session.id"
        type="button"
        class="history-item"
        :class="{ active: activeSessionId === session.id }"
        @click="$emit('selectSession', session.id)"
      >
        <span>{{ session.title }}</span>
        <small>{{ session.time }}</small>
      </button>
    </div>
  </aside>
</template>
