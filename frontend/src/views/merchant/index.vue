<script setup lang="ts">
import { ref } from 'vue'

interface Merchant {
  id: string
  name: string
  category: string
  orders: number
  growth: number
  score: number
  status: 'healthy' | 'warning' | 'risk'
}

const search = ref('')
const categoryFilter = ref('all')

const merchants = ref<Merchant[]>([
  { id: 'M001', name: '蒸湘万达·麦当劳', category: '正餐', orders: 286, growth: 18, score: 92, status: 'healthy' },
  { id: 'M002', name: '晶珠·星巴克', category: '饮品', orders: 198, growth: 12, score: 88, status: 'healthy' },
  { id: 'M003', name: '衡阳万达·海底捞', category: '正餐', orders: 156, growth: -8, score: 72, status: 'warning' },
  { id: 'M004', name: '步步高·奈雪', category: '饮品', orders: 142, growth: 24, score: 95, status: 'healthy' },
  { id: 'M005', name: '太阳广场·沙县小吃', category: '快餐', orders: 98, growth: -15, score: 58, status: 'risk' },
  { id: 'M006', name: '高新区·西贝莜面', category: '正餐', orders: 178, growth: 6, score: 84, status: 'healthy' },
  { id: 'M007', name: '金钟·肯德基', category: '快餐', orders: 256, growth: 9, score: 90, status: 'healthy' },
  { id: 'M008', name: '解放路·喜茶', category: '饮品', orders: 174, growth: 32, score: 96, status: 'healthy' }
])

const scoreColor = (s: number) => (s >= 85 ? '#00b578' : s >= 70 ? '#ff9500' : '#f53f3f')

const scoreClass = (s: number) =>
  s >= 85 ? 'success' : s >= 70 ? 'warning' : 'danger'

const statusText = (s: Merchant['status']) =>
  ({ healthy: '健康', warning: '关注', risk: '高风险' }[s])
</script>

<template>
  <div class="page-container">
    <!-- 顶部统计 -->
    <div class="health-stats">
      <div class="hs-card healthy">
        <div class="hs-count">286</div>
        <div class="hs-label">健康商户</div>
        <div class="hs-bar"><div class="bar-fill" :style="{ width: '78%', background: '#00b578' }"></div></div>
      </div>
      <div class="hs-card warning">
        <div class="hs-count">52</div>
        <div class="hs-label">关注商户</div>
        <div class="hs-bar"><div class="bar-fill" :style="{ width: '14%', background: '#ff9500' }"></div></div>
      </div>
      <div class="hs-card risk">
        <div class="hs-count">28</div>
        <div class="hs-label">高风险商户</div>
        <div class="hs-bar"><div class="bar-fill" :style="{ width: '8%', background: '#f53f3f' }"></div></div>
      </div>
      <div class="hs-card overall">
        <div class="hs-count">82.6</div>
        <div class="hs-label">平台健康度评分</div>
        <div class="hs-bar"><div class="bar-fill" :style="{ width: '82.6%', background: '#1f6feb' }"></div></div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-head">
        <span class="card-title">商户健康度列表</span>
        <div class="head-actions">
          <el-select v-model="categoryFilter" size="small" style="width: 120px">
            <el-option label="全部分类" value="all" />
            <el-option label="正餐" value="dinner" />
            <el-option label="快餐" value="fast" />
            <el-option label="饮品" value="drink" />
          </el-select>
          <el-input v-model="search" :prefix-icon="'Search'" placeholder="搜索商户" size="small" style="width: 200px" />
          <el-button size="small" type="primary">导出报告</el-button>
        </div>
      </div>

      <div class="merchants-grid">
        <div v-for="m in merchants" :key="m.id" class="m-card">
          <div class="m-head">
            <div>
              <div class="m-name">{{ m.name }}</div>
              <el-tag size="small" effect="plain">{{ m.category }}</el-tag>
            </div>
            <div class="m-score" :style="{ color: scoreColor(m.score) }">
              {{ m.score }}
            </div>
          </div>
          <div class="m-stats">
            <div class="ms-item">
              <div class="ms-label">今日订单</div>
              <div class="ms-value">{{ m.orders }}</div>
            </div>
            <div class="ms-item">
              <div class="ms-label">环比</div>
              <div class="ms-value" :class="m.growth > 0 ? 'text-success' : 'text-danger'">
                {{ m.growth > 0 ? '+' : '' }}{{ m.growth }}%
              </div>
            </div>
            <div class="ms-item">
              <div class="ms-label">状态</div>
              <el-tag :type="scoreClass(m.score) === 'success' ? 'success' : scoreClass(m.score) === 'warning' ? 'warning' : 'danger'" size="small">
                {{ statusText(m.status) }}
              </el-tag>
            </div>
          </div>
          <div class="m-actions">
            <el-button link type="primary" size="small">查看详情</el-button>
            <el-button link type="primary" size="small">运营建议</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
