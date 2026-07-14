<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, User, Download } from '@element-plus/icons-vue'
import request from '@/api/request'
import { useCityStore } from '@/store/city'

const cityStore = useCityStore()
const city = cityStore.currentCity

const fabOpen = ref(false)
const dialogOpen = ref(false)
const dialogTab = ref('add')  // 'add' | 'import'
const loading = ref(false)

const form = ref({
  native_place: '',
  city_name: '衡阳',
  station_name: '',
  rider_level_name: '淡定青铜',
  life_cycle1: '活跃期',
  service_score: 0,
  rider_score: 0
})

const fileText = ref('')
const fileName = ref('')

const levelOptions = ['淡定青铜', '奋进铂金', '坚韧钻石', '傲世星辰', '霸气王者']
const cityOptions = ['衡阳', '绍兴', '常德', '衢州']
const lifecycleOptions = ['活跃期', '新手期', '流失期', '注册未首跑']

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

function toggleFab() {
  fabOpen.value = !fabOpen.value
}

function openAddDialog() {
  fabOpen.value = false
  dialogTab.value = 'add'
  form.value = {
    native_place: '',
    city_name: city.name || '衡阳',
    station_name: '',
    rider_level_name: '淡定青铜',
    life_cycle1: '活跃期',
    service_score: 0,
    rider_score: 0
  }
  dialogOpen.value = true
}

function openImportDialog() {
  fabOpen.value = false
  dialogTab.value = 'import'
  fileText.value = ''
  fileName.value = ''
  dialogOpen.value = true
}

function downloadTemplate() {
  const csv = `native_place,city_name,station_name,rider_level_name,life_cycle1,service_score,rider_score
湖南省_衡阳市_衡阳县,衡阳,蒸湘万达站,奋进铂金,活跃期,1250,85.5
湖南省_衡阳市_衡南县,衡阳,解放路站,淡定青铜,新手期,420,72.0
广东省_深圳市_南山区,深圳,科技园站,坚韧钻石,活跃期,3200,92.0`
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '骑手导入模板.csv'
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('模板已下载')
}

async function handleFileChange(file: any) {
  fileName.value = file.name
  const text = await file.raw.text()
  fileText.value = text
  return false  // 阻止自动上传
}

async function submitAdd() {
  if (!form.value.native_place) {
    ElMessage.warning('请填写籍贯')
    return
  }
  if (!form.value.station_name) {
    ElMessage.warning('请填写站点')
    return
  }
  loading.value = true
  try {
    const r: any = await request({
      url: '/riders/add',
      method: 'POST',
      data: { ...form.value }
    })
    if (r.id) {
      ElMessage.success(`添加成功：${form.value.native_place}`)
      dialogOpen.value = false
      emit('refresh')
    } else {
      ElMessage.error('添加失败')
    }
  } catch (e: any) {
    ElMessage.error('添加失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function submitImport() {
  if (!fileText.value) {
    ElMessage.warning('请先选择 CSV 文件')
    return
  }
  loading.value = true
  try {
    const r: any = await request({
      url: '/riders/import',
      method: 'POST',
      data: { csv: fileText.value }
    })
    if (r.added !== undefined) {
      await ElMessageBox.alert(
        `<b>${r.message}</b><br><br>错误数: ${r.errors?.length || 0}<br>${r.errors?.slice(0, 3).join('<br>') || '无'}`,
        '导入完成',
        { dangerouslyUseHTMLString: true }
      )
      dialogOpen.value = false
      emit('refresh')
    } else {
      ElMessage.error(r.message || '导入失败')
    }
  } catch (e: any) {
    ElMessage.error('导入失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- 悬浮球（FAB） -->
  <div class="fab-container">
    <transition name="fab-menu">
      <div v-if="fabOpen" class="fab-menu">
        <button class="fab-menu-btn" @click="openAddDialog">
          <el-icon><User /></el-icon>
          <span>添加单个骑手</span>
        </button>
        <button class="fab-menu-btn" @click="openImportDialog">
          <el-icon><Upload /></el-icon>
          <span>批量导入 CSV</span>
        </button>
        <button class="fab-menu-btn" @click="downloadTemplate">
          <el-icon><Download /></el-icon>
          <span>下载导入模板</span>
        </button>
      </div>
    </transition>
    <button class="fab-main" :class="{ open: fabOpen }" @click="toggleFab">
      <el-icon :size="24">
        <Plus v-if="!fabOpen" />
        <span v-else style="font-size: 24px">×</span>
      </el-icon>
    </button>
  </div>

  <!-- 上传弹窗 -->
  <el-dialog v-model="dialogOpen" :title="dialogTab === 'add' ? '添加骑手' : '批量导入骑手'" width="560px" :close-on-click-modal="false">
    <!-- 单个添加 -->
    <template v-if="dialogTab === 'add'">
      <el-form label-width="100px" :model="form">
        <el-form-item label="籍贯" required>
          <el-input v-model="form.native_place" placeholder="如：湖南省_衡阳市_衡阳县" />
        </el-form-item>
        <el-form-item label="城市" required>
          <el-select v-model="form.city_name" style="width: 100%">
            <el-option v-for="c in cityOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属站点" required>
          <el-input v-model="form.station_name" placeholder="如：蒸湘万达站" />
        </el-form-item>
        <el-form-item label="服务等级">
          <el-select v-model="form.rider_level_name" style="width: 100%">
            <el-option v-for="l in levelOptions" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="生命周期">
          <el-select v-model="form.life_cycle1" style="width: 100%">
            <el-option v-for="l in lifecycleOptions" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务分">
          <el-input-number v-model="form.service_score" :min="0" :max="99999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="骑手分">
          <el-input-number v-model="form.rider_score" :min="0" :max="100" :step="0.1" style="width: 100%" />
        </el-form-item>
      </el-form>
    </template>

    <!-- 批量导入 -->
    <template v-else>
      <div class="import-tips">
        <p>📋 <b>使用说明：</b></p>
        <p>1. 点击「下载导入模板」获取标准 CSV</p>
        <p>2. 按模板格式填写骑手信息（必填：籍贯、城市、站点）</p>
        <p>3. 上传 CSV 文件，系统自动批量导入</p>
      </div>
      <el-upload
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
        accept=".csv,.txt"
      >
        <div v-if="!fileText" class="upload-trigger">
          <el-icon style="font-size: 48px; color: #409eff;"><Upload /></el-icon>
          <div>点击或拖拽 CSV 文件到此处</div>
          <div class="upload-hint">支持 .csv / .txt 格式</div>
        </div>
        <div v-else class="upload-selected">
          📄 {{ fileName }}（{{ fileText.split('\n').length - 1 }} 行数据）
        </div>
      </el-upload>
    </template>

    <template #footer>
      <el-button @click="dialogOpen = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="dialogTab === 'add' ? submitAdd() : submitImport()">
        {{ dialogTab === 'add' ? '添加' : '开始导入' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
/* 悬浮球容器 */
.fab-container {
  position: fixed;
  right: 32px;
  bottom: 80px;
  z-index: 1000;
}

.fab-main {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1f6feb, #4080ff);
  color: #fff;
  border: none;
  box-shadow: 0 6px 16px rgba(31, 111, 235, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s, box-shadow 0.3s;

  &:hover { transform: scale(1.05); box-shadow: 0 8px 20px rgba(31, 111, 235, 0.5); }

  &.open { background: linear-gradient(135deg, #f5222d, #ff4d4f); transform: rotate(90deg); }
}

.fab-menu {
  position: absolute;
  bottom: 72px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.fab-menu-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  color: #1f2d3d;
  border: none;
  border-radius: 24px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover { transform: translateX(-4px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15); }
  .el-icon { color: #1f6feb; }
}

.fab-menu-enter-active, .fab-menu-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fab-menu-enter-from, .fab-menu-leave-to { opacity: 0; transform: translateY(10px); }

/* 导入说明 */
.import-tips {
  background: #f0f7ff;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #1f2d3d;
  line-height: 1.8;
  p { margin: 0; }
}

/* 上传区域 */
.upload-trigger {
  text-align: center;
  padding: 24px 0;
  color: #606266;
  .upload-hint { font-size: 12px; color: #909399; margin-top: 4px; }
}

.upload-selected {
  text-align: center;
  padding: 24px 0;
  font-size: 14px;
  color: #00b578;
  font-weight: 500;
}
</style>
