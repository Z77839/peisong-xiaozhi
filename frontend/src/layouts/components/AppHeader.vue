<script setup lang="ts">
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { useUserStore } from '@/store/user'
import { useCityStore } from '@/store/city'
import { useAppStore } from '@/store/app'
import { ElMessageBox, ElDropdown, ElDropdownMenu, ElDropdownItem, ElAvatar, ElBadge, ElTooltip, ElButton, ElIcon, ElTag, ElSelect, ElOption } from 'element-plus'
import { Expand, FullScreen, QuestionFilled, Bell, ArrowDown, User, Setting, SwitchButton, Position } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()
const cityStore = useCityStore()

const toggleSidebar = () => appStore.toggleSidebar()

const handleLogout = () => {
  ElMessageBox.confirm('确认退出登录吗？', '提示', {
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      userStore.logout()
      router.push('/login')
    })
    .catch(() => {})
}

// 角色映射
const roleMap: Record<string, { label: string; color: string }> = {
  admin: { label: '系统管理员', color: '#f56c6c' },
  operator: { label: '运营分析师', color: '#e6a23c' },
  viewer: { label: '数据分析师', color: '#909399' }
}
const roleLabel = computed(() => {
  const role = userStore.userInfo?.role || 'viewer'
  return roleMap[role]?.label || role
})
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <el-button text size="large" @click="toggleSidebar">
        <el-icon><Expand /></el-icon>
      </el-button>

      <!-- 城市切换器 -->
      <div class="city-switcher">
        <el-icon><Position /></el-icon>
        <span class="city-label">城市:</span>
        <el-select v-model="cityStore.currentCityId" size="small" style="width: 120px" @change="cityStore.setCity">
          <el-option
            v-for="c in cityStore.cities"
            :key="c.id"
            :value="c.id"
            :label="`${c.name} (${c.province})`"
          />
        </el-select>
      </div>

      <el-tag type="warning" effect="plain" round size="small">演示环境</el-tag>
    </div>

    <div class="header-right">
      <el-tooltip content="全屏" placement="bottom">
        <el-button text size="large">
          <el-icon><FullScreen /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="帮助中心" placement="bottom">
        <el-button text size="large">
          <el-icon><QuestionFilled /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="通知" placement="bottom">
        <el-button text size="large">
          <el-badge :value="3" :max="9" :offset="[-2, 2]">
            <el-icon><Bell /></el-icon>
          </el-badge>
        </el-button>
      </el-tooltip>

      <el-dropdown trigger="click">
        <div class="user-info">
          <el-avatar :size="28" :src="userStore.userInfo?.avatar">
            {{ userStore.userInfo?.nickname?.slice(0, 1) || 'U' }}
          </el-avatar>
          <span class="user-name">{{ userStore.userInfo?.nickname || '未登录' }}</span>
          <el-tag
            :type="userStore.userInfo?.role === 'admin' ? 'danger' : userStore.userInfo?.role === 'operator' ? 'warning' : 'info'"
            size="small"
            effect="dark"
            style="margin-left: 6px;"
          >
            {{ roleLabel }}
          </el-tag>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>
              <el-icon><User /></el-icon> 个人中心
            </el-dropdown-item>
            <el-dropdown-item>
              <el-icon><Setting /></el-icon> 账号设置
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">
              <el-icon><SwitchButton /></el-icon> 退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
