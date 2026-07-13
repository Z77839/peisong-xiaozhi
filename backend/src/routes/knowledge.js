/**
 * 知识库路由 - 文档上传/管理
 * 支持 PDF/DOCX/TXT/MD，单文件 20MB
 * 存储：本地 uploads 目录 + 内存索引（生产可换 PG）
 */
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { logger } from '../services/logger.js'
import { authRequired } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. 上传目录（uploads/ 在项目根）
const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads/knowledge')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  logger.info(`[Knowledge] 创建上传目录: ${UPLOAD_DIR}`)
}

// 2. multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // 处理中文文件名
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = path.extname(originalName)
    const baseName = path.basename(originalName, ext)
    // 时间戳 + 随机后缀防止重名
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    cb(null, `${timestamp}_${random}${ext}`)
  }
})

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain', // .txt
  'text/markdown', // .md
  'text/x-markdown',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/json'
]

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    // 修复中文文件名
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = path.extname(file.originalname).toLowerCase()
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.xls', '.json']
    if (ALLOWED_TYPES.includes(file.mimetype) || allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype || ext}`))
    }
  }
})

// 3. 内存索引（生产可换 PG knowledge_documents 表）
const knowledgeIndex = new Map()

// 4. 路由
const router = express.Router()

// 4.1 上传文档
router.post('/upload', authRequired, (req, res) => {
  // 用 multer 处理（accept 多个字段名 file/document/file）
  const uploadMiddleware = upload.single('file')
  uploadMiddleware(req, res, (err) => {
    if (err) {
      logger.warn(`[Knowledge] 上传失败: ${err.message}`)
      return res.status(400).json({ code: 400, message: err.message })
    }
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '未收到文件' })
    }

    const { originalname, filename, size, mimetype, path: filePath } = req.file
    const cat = req.body.cat || '其他'
    const desc = req.body.desc || ''

    const doc = {
      id: Date.now().toString(),
      title: originalname,
      cat,
      desc,
      filename,
      size,
      mimetype,
      url: `/uploads/knowledge/${filename}`,
      uploadedBy: req.user?.username || 'admin',
      uploadedAt: new Date().toISOString(),
      updated: '刚刚',
      views: 0
    }
    knowledgeIndex.set(doc.id, doc)
    logger.info(`[Knowledge] 上传成功: ${originalname} (${(size/1024).toFixed(1)}KB)`)

    res.json({ code: 200, message: '上传成功', data: doc })
  })
})

// 4.2 列表（搜索 + 分类）
router.get('/list', authRequired, (req, res) => {
  const { search = '', cat = '' } = req.query
  let list = Array.from(knowledgeIndex.values())
  if (cat) list = list.filter(d => d.cat === cat)
  if (search) {
    const kw = String(search).toLowerCase()
    list = list.filter(d =>
      d.title.toLowerCase().includes(kw) ||
      (d.desc || '').toLowerCase().includes(kw)
    )
  }
  // 按时间倒序
  list.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  res.json({ code: 200, data: list, total: list.length })
})

// 4.3 删除
router.delete('/:id', authRequired, (req, res) => {
  const { id } = req.params
  const doc = knowledgeIndex.get(id)
  if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })

  // 删除文件
  const filePath = path.join(UPLOAD_DIR, doc.filename)
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath) } catch (e) { logger.warn(`[Knowledge] 删除文件失败: ${e.message}`) }
  }
  knowledgeIndex.delete(id)
  logger.info(`[Knowledge] 删除: ${doc.title}`)
  res.json({ code: 200, message: '删除成功' })
})

// 4.4 增加浏览次数
router.post('/:id/view', authRequired, (req, res) => {
  const { id } = req.params
  const doc = knowledgeIndex.get(id)
  if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })
  doc.views = (doc.views || 0) + 1
  res.json({ code: 200, data: { views: doc.views } })
})

// 4.5 错误处理
router.use((err, req, res, next) => {
  logger.error(`[Knowledge] 错误: ${err.message}`)
  res.status(500).json({ code: 500, message: err.message })
})

export default router
