<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Delete, View, Download } from '@element-plus/icons-vue'
import request from '@/api/request'
import { API_BASE_URL } from '@/utils/apiBase'

const activeTab = ref('docs')
const search = ref('')
const uploadDialog = ref(false)
const uploadCat = ref('运营')
const uploadDesc = ref('')
const uploadFile = ref<any>(null)
const uploading = ref(false)

const docs = ref<any[]>([])
const faqs = ref([
  { q: '如何调整 AI 预测模型参数？', a: '在 系统设置 → 模型配置 中调整...' },
  { q: '运力缺口如何快速响应？', a: '启用储备骑手 + 启动临时补贴...' },
  { q: '运营报告如何定时推送？', a: '在 报告中心 → 订阅设置 中配置...' }
])

const cats = ['运营', '调度', '应急', '商户', '算法', '其他']

const filteredDocs = computed(() => {
  if (!search.value) return docs.value
  const kw = search.value.toLowerCase()
  return docs.value.filter(d =>
    d.title?.toLowerCase().includes(kw) ||
    (d.desc || '').toLowerCase().includes(kw)
  )
})

const formatSize = (bytes: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const formatTime = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前'
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前'
  return d.toLocaleDateString('zh-CN')
}

const loadDocs = async () => {
  try {
    const res: any = await request.get('/knowledge/list')
    if (res.code === 200) {
      docs.value = res.data || []
    }
  } catch (e: any) {
    console.warn('加载知识库失败', e?.message)
    ElMessage.error('加载知识库失败: ' + (e?.message || '网络错误'))
  }
}

const onFileChange = (file: any) => {
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 20MB')
    return false
  }
  uploadFile.value = file
  return false // 阻止自动上传
}

const handleUpload = async () => {
  if (!uploadFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', uploadFile.value.raw)
    fd.append('cat', uploadCat.value)
    fd.append('desc', uploadDesc.value)
    // 不设 Content-Type，axios 会自动加 multipart/form-data; boundary=xxx
    const res: any = await request.post('/knowledge/upload', fd)
    if (res.code === 200) {
      ElMessage.success('上传成功')
      uploadDialog.value = false
      uploadFile.value = null
      uploadDesc.value = ''
      await loadDocs()
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (e: any) {
    const detail = e?.response?.data?.message || e?.message || '未知错误'
    ElMessage.error('上传失败: ' + detail)
    console.error('[Upload] 详细错误:', e?.response?.data || e)
  } finally {
    uploading.value = false
  }
}

const handleDelete = async (doc: any) => {
  try {
    await ElMessageBox.confirm(`确认删除「${doc.title}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    const res: any = await request.delete(`/knowledge/${doc.id}`)
    if (res.code === 200) {
      ElMessage.success('已删除')
      await loadDocs()
    }
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败: ' + (e?.message || '未知错误'))
    }
  }
}

const handleView = async (doc: any) => {
  if (doc.url) {
    // 拼接完整 URL（后端有静态服务 uploads 目录）
    const fullUrl = doc.url.startsWith('http') ? doc.url : `${API_BASE_URL}${doc.url}`
    window.open(fullUrl, '_blank')
    try {
      await request.post(`/knowledge/${doc.id}/view`)
    } catch {}
  } else {
    ElMessage.info('未上传到服务器')
  }
}

const handleDownload = (doc: any) => {
  if (doc.url) {
    const fullUrl = doc.url.startsWith('http') ? doc.url : `${API_BASE_URL}/knowledge/download/${doc.id}`
    const a = document.createElement('a')
    a.href = fullUrl
    a.download = doc.title
    a.click()
  } else {
    ElMessage.info('未上传到服务器')
  }
}

onMounted(() => {
  loadDocs()
})
</script>

<template>
  <div class="page-container">
    <div class="kb-toolbar">
      <div class="search-box">
        <el-input
          v-model="search"
          placeholder="搜索知识库内容..."
          size="large"
          style="width: 400px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
      <div class="kb-actions">
        <el-button size="large" type="primary" @click="uploadDialog = true">
          <el-icon><Plus /></el-icon>
          上传文档
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="kb-tabs">
      <el-tab-pane :label="`📚 文档库 (${docs.length})`" name="docs" />
      <el-tab-pane label="❓ 常见问题" name="faqs" />
      <el-tab-pane label="🎓 培训资料" name="training" />
      <el-tab-pane label="📊 数据字典" name="dict" />
    </el-tabs>

    <div v-if="activeTab === 'docs'" class="kb-content">
      <div v-if="filteredDocs.length === 0" class="empty-state">
        <el-empty description="还没有文档，点击右上角「上传文档」开始添加" />
      </div>
      <div v-else class="doc-grid">
        <div v-for="d in filteredDocs" :key="d.id" class="doc-card">
          <div class="doc-icon">📄</div>
          <div class="doc-meta">
            <div class="doc-title" :title="d.title">{{ d.title }}</div>
            <el-tag size="small" effect="plain" type="primary">{{ d.cat || '其他' }}</el-tag>
            <div v-if="d.size" class="doc-size">{{ formatSize(d.size) }}</div>
          </div>
          <div class="doc-info">
            <span>{{ d.updated || formatTime(d.uploadedAt) }}</span> · <span>{{ d.views || 0 }} 浏览</span>
          </div>
          <div class="doc-actions">
            <el-button link type="primary" size="small" @click="handleView(d)">
              <el-icon><View /></el-icon> 查看
            </el-button>
            <el-button link type="primary" size="small" @click="handleDownload(d)">
              <el-icon><Download /></el-icon> 下载
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(d)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'faqs'" class="kb-content">
      <el-collapse>
        <el-collapse-item v-for="(f, i) in faqs" :key="i" :title="f.q" :name="String(i)">
          <p>{{ f.a }}</p>
        </el-collapse-item>
      </el-collapse>
    </div>

    <div v-else class="kb-content">
      <el-empty description="该分类内容正在整理中..." />
    </div>

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadDialog" title="上传文档" width="500px">
      <el-form label-width="80px">
        <el-form-item label="选择文件">
          <el-upload
            drag
            :auto-upload="false"
            :on-change="onFileChange"
            :show-file-list="false"
            accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.json"
          >
            <div v-if="!uploadFile" class="upload-trigger">
              <el-icon style="font-size: 48px; color: #409eff;"><Plus /></el-icon>
              <div>点击或拖拽文件到此处</div>
              <div class="upload-hint">支持 PDF / Word / Excel / TXT / MD / JSON（最大 20MB）</div>
            </div>
            <div v-else class="upload-selected">
              📄 {{ uploadFile.name }} ({{ formatSize(uploadFile.size) }})
            </div>
          </el-upload>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="uploadCat" style="width: 100%">
            <el-option v-for="c in cats" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadDesc" type="textarea" :rows="3" placeholder="选填，文档简介" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">开始上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

.page-container {
  padding: 24px;
}

.kb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.kb-tabs {
  margin-bottom: 24px;
}

.kb-content {
  min-height: 400px;
}

.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.doc-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #409eff;
  }
}

.doc-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.doc-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-size {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.doc-info {
  font-size: 12px;
  color: #909399;
  margin: 12px 0;
}

.doc-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

.empty-state {
  padding: 60px 0;
}

.upload-trigger {
  text-align: center;
  color: #606266;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.upload-selected {
  text-align: center;
  color: #409eff;
  font-weight: 500;
}
</style>
