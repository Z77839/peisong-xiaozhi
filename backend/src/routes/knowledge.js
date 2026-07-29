/**
 * 知识库路由 v2 - 文档上传/管理 + 决策中心集成
 *
 * 存储：JSON 文件持久化（data/knowledge_index.json）
 * 集成：决策中心自动调用 search() 把相关文档注入 prompt
 *
 * 支持 PDF/DOCX/TXT/MD/XLSX/JSON
 * 单文件 20MB
 */
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { logger } from '../services/logger.js'
import { scheduleBackup } from '../services/backupService.js'
import { authRequired } from '../middleware/auth.js'
// 🆕 经验案例检索（高 success_rate 加权）
import { searchCases } from '../services/experienceService.js'
// 🆕 语义检索：豆包 embedding
import { embed, cosineSimilarity, precomputeDocEmbeddings, stats as embeddingStats } from '../services/embeddingService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads/knowledge')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  logger.info(`[Knowledge] 创建上传目录: ${UPLOAD_DIR}`)
}

// 持久化 JSON
const INDEX_FILE = path.resolve(process.cwd(), 'data/knowledge_index.json')


/**
 * 解析上传的文档，抽取文本内容
 * 支持：PDF (pdf-parse), DOCX (mammoth), TXT/MD/JSON (fs)
 * 上限 20MB（与 multer 一致）
 */
async function parseDocument(filePath, ext, size) {
  ext = (ext || '').toLowerCase()
  if (size > 20 * 1024 * 1024) {
    logger.warn(`[Knowledge] 文件过大，跳过内容抽取: ${filePath} (${(size/1024/1024).toFixed(1)}MB)`)
    return ''
  }
  try {
    if (ext === '.pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const buffer = fs.readFileSync(filePath)
      const data = await pdfParse(buffer)
      const text = data.text || ''
      logger.info(`[Knowledge] PDF 解析: ${(size/1024).toFixed(1)}KB → ${text.length} chars`)
      return text
    }
    if (ext === '.docx') {
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.extractRawText({ path: filePath })
      const text = result.value || ''
      logger.info(`[Knowledge] DOCX 解析: ${(size/1024).toFixed(1)}KB → ${text.length} chars`)
      return text
    }
    if (ext === '.doc') {
      logger.warn(`[Knowledge] .doc 格式不支持解析（请转为 .docx）`)
      return ''
    }
    if (['.txt', '.md', '.json'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
    return ''
  } catch (e) {
    logger.warn(`[Knowledge] 文档解析失败 (${ext}): ${e.message}`)
    return ''
  }
}

// 加载持久化索引
function loadIndex() {
  if (fs.existsSync(INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'))
    } catch (e) {
      logger.warn(`[Knowledge] 索引加载失败: ${e.message}`)
    }
  }
  return []
}

function saveIndex(arr) {
  try {
    if (!fs.existsSync(path.dirname(INDEX_FILE))) {
      fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true })
    }
    fs.writeFileSync(INDEX_FILE, JSON.stringify(arr, null, 2))
    scheduleBackup()
  } catch (e) {
    logger.error(`[Knowledge] 索引保存失败: ${e.message}`)
  }
}

// 启动时加载
let knowledgeIndex = new Map()
for (const d of loadIndex()) {
  knowledgeIndex.set(d.id, d)
}
logger.info(`[Knowledge] 加载 ${knowledgeIndex.size} 条历史文档`)

// 🆕 docEmbeddings 在 bootstrapSeed 之后由 IIFE 填充
let docEmbeddings = new Map()


// multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = path.extname(originalName)
    const baseName = path.basename(originalName, ext)
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    // 保留中文文件名（URL 编码）
    cb(null, `${timestamp}_${random}${ext}`)
  }
})

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'application/octet-stream' // 浏览器有时候识别不出 mime
]

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
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

/**
 * 启动时如果 knowledge_index.json 是空，从 seed 导入
 */
// 🆕 多路径查找 SEED（兼容 Render Native runtime 不同的 cwd）
function findSeedFile() {
  const candidates = [
    path.resolve(process.cwd(), 'data/knowledge_seed.json'),
    path.resolve(process.cwd(), '../data/knowledge_seed.json'),
    path.resolve(process.cwd(), '../../data/knowledge_seed.json'),
    '/opt/render/project/src/backend/data/knowledge_seed.json',
    '/opt/render/project/src/data/knowledge_seed.json',
    '/app/data/knowledge_seed.json',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function bootstrapSeed() {
  const INDEX = path.resolve(process.cwd(), 'data/knowledge_index.json')
  const SEED = findSeedFile()

  // 诊断 log
  console.log(`[Knowledge] bootstrapSeed: cwd=${process.cwd()}`)
  console.log(`[Knowledge] bootstrapSeed: SEED path=${SEED || 'NOT FOUND'}`)

  let needSeed = false
  if (!fs.existsSync(INDEX)) {
    needSeed = true
  } else {
    try {
      const cur = JSON.parse(fs.readFileSync(INDEX, 'utf-8'))
      if (!cur.items || cur.items.length === 0) needSeed = true
    } catch (e) { needSeed = true }
  }

  if (!needSeed) return
  if (!SEED) {
    console.warn(`[Knowledge] bootstrapSeed: SEED 找不到，跳过自动 seed（可手动调 POST /api/knowledge/seed）`)
    return
  }

  try {
    const seed = JSON.parse(fs.readFileSync(SEED, 'utf-8'))
    fs.mkdirSync(path.dirname(INDEX), { recursive: true })
    fs.writeFileSync(INDEX, JSON.stringify(seed, null, 2))
    // 关键修复：写完 INDEX 后刷新内存
    knowledgeIndex = new Map()
    for (const d of loadIndex()) {
      knowledgeIndex.set(d.id, d)
    }
    console.log(`[Knowledge] 已从 seed 导入 ${seed.items.length} 条, 内存 ${knowledgeIndex.size} 条`)
  } catch (e) {
    console.error('[Knowledge] seed 导入失败:', e.message)
  }
}
bootstrapSeed()

// 🆕 启动时预计算文档 embedding（必须在 bootstrapSeed 之后，因为 docEmbeddings 依赖 knowledgeIndex）
;(async () => {
  try {
    // 等一下让 bootstrapSeed 同步跑完
    await new Promise(r => setImmediate(r))
    docEmbeddings = await precomputeDocEmbeddings(Array.from(knowledgeIndex.values()))
    logger.info(`[Knowledge] 文档 embedding 就绪: ${docEmbeddings.size}/${knowledgeIndex.size}`)
  } catch (e) {
    logger.warn(`[Knowledge] embedding 预计算失败（将走纯关键词检索）: ${e.message}`)
  }
})()

const router = express.Router()

// 1. 上传文档
router.post('/upload', authRequired, async (req, res) => {
  const uploadMiddleware = upload.single('file')
  uploadMiddleware(req, res, async (err) => {
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

    // 🆕 解析文档内容（PDF/DOCX/MD/TXT/JSON）
    const ext = path.extname(originalname).toLowerCase()
    const content = await parseDocument(filePath, ext, size)
    const contentPreview = content.slice(0, 500)
    if (content) {
      logger.info(`[Knowledge] 内容抽取: ${originalname} (${ext}) → ${content.length} chars`)
    } else if (['.pdf', '.docx', '.docx', '.txt', '.md', '.json'].includes(ext)) {
      logger.warn(`[Knowledge] 内容抽取为空: ${originalname} (${ext})`)
    }

    const doc = {
      id: Date.now().toString(),
      title: originalname,
      cat,
      desc,
      filename,
      size,
      mimetype: mimetype || 'application/octet-stream',
      url: `/uploads/knowledge/${filename}`,
      uploadedBy: req.user?.username || 'admin',
      uploadedAt: new Date().toISOString(),
      updated: '刚刚',
      views: 0,
      content,        // 内部使用
      contentPreview  // 列表展示
    }
    knowledgeIndex.set(doc.id, doc)
    saveIndex(Array.from(knowledgeIndex.values()))
    logger.info(`[Knowledge] 上传成功: ${originalname} (${(size/1024).toFixed(1)}KB) [${knowledgeIndex.size} 条]`)
    res.json({ code: 200, message: '上传成功', data: doc })
  })
})

// 2. 列表（搜索 + 分类）
router.get('/list', authRequired, (req, res) => {
  const { search = '', cat = '' } = req.query
  let list = Array.from(knowledgeIndex.values())
  if (cat) list = list.filter(d => d.cat === cat)
  if (search) {
    const kw = String(search).toLowerCase()
    list = list.filter(d =>
      d.title.toLowerCase().includes(kw) ||
      (d.desc || '').toLowerCase().includes(kw) ||
      (d.content || '').toLowerCase().includes(kw)
    )
  }
  list.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  // 不返回 content（太大）
  const light = list.map(d => ({ ...d, content: undefined }))
  res.json({ code: 200, data: light, total: list.length })
})

// 3. 删除
router.delete('/:id', authRequired, (req, res) => {
  const { id } = req.params
  const doc = knowledgeIndex.get(id)
  if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })

  const filePath = path.join(UPLOAD_DIR, doc.filename)
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath) } catch (e) { logger.warn(`[Knowledge] 删除文件失败: ${e.message}`) }
  }
  knowledgeIndex.delete(id)
  saveIndex(Array.from(knowledgeIndex.values()))
  logger.info(`[Knowledge] 删除: ${doc.title} [剩余 ${knowledgeIndex.size} 条]`)
  res.json({ code: 200, message: '删除成功' })
})

// 4. 浏览次数
router.post('/:id/view', authRequired, (req, res) => {
  const { id } = req.params
  const doc = knowledgeIndex.get(id)
  if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })
  doc.views = (doc.views || 0) + 1
  saveIndex(Array.from(knowledgeIndex.values()))
  res.json({ code: 200, data: { views: doc.views } })
})

// 5. 知识库内容检索（用 searchKnowledge 函数，含中文分词）
router.get('/search', authRequired, (req, res) => {
  const { q = '', limit = 3 } = req.query
  const kw = String(q).toLowerCase().trim()
  if (!kw) return res.json({ code: 200, data: [], total: 0 })
  const results = searchKnowledge(kw, Number(limit))
  const enriched = results.map(r => ({
    ...r,
    contentPreview: r.excerpt
  }))
  res.json({ code: 200, data: enriched, total: enriched.length, query: q })
})


// 🆕 embedding 服务状态
router.get('/embedding/stats', authRequired, (req, res) => {
  res.json({ code: 0, data: embeddingStats() })
})

// 6. 下载文件
router.get('/download/:id', authRequired, (req, res) => {
  const { id } = req.params
  const doc = knowledgeIndex.get(id)
  if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })
  const filePath = path.join(UPLOAD_DIR, doc.filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ code: 404, message: '文件不存在' })
  }
  res.download(filePath, doc.title)
})



// 提取关键词附近 200 字
function extractExcerpt(text, kw, len) {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(kw)
  if (idx === -1) return text.slice(0, len)
  const start = Math.max(0, idx - 50)
  const end = Math.min(text.length, idx + len)
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
}

// 7. 🆕 知识库统计
// 🆕 手动触发 seed 导入（dev 用）
router.post('/seed', authRequired, (req, res) => {
  const INDEX = path.resolve(process.cwd(), 'data/knowledge_index.json')
  const SEED = path.resolve(process.cwd(), 'data/knowledge_seed.json')
  if (!fs.existsSync(SEED)) {
    return res.status(404).json({ code: 404, message: 'seed 文件不存在' })
  }
  try {
    const seed = JSON.parse(fs.readFileSync(SEED, 'utf-8'))
    fs.mkdirSync(path.dirname(INDEX), { recursive: true })
    fs.writeFileSync(INDEX, JSON.stringify(seed, null, 2))
    // 🔄 重新加载到内存
    knowledgeIndex.clear()
    for (const item of seed.items) {
      knowledgeIndex.set(item.id, item)
    }
    res.json({ code: 200, message: `seed 导入 ${seed.items.length} 条`, data: { count: seed.items.length } })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

router.get('/stats', authRequired, (req, res) => {
  const docs = Array.from(knowledgeIndex.values())
  const byCat = {}
  for (const d of docs) {
    byCat[d.cat] = (byCat[d.cat] || 0) + 1
  }
  res.json({
    code: 200,
    data: {
      total: docs.length,
      totalSize: docs.reduce((s, d) => s + (d.size || 0), 0),
      byCat,
      latest: docs.slice(0, 5).map(d => ({ id: d.id, title: d.title, cat: d.cat, uploadedAt: d.uploadedAt }))
    }
  })
})

// 错误处理
router.use((err, req, res, next) => {
  logger.error(`[Knowledge] 错误: ${err.message}`)
  res.status(500).json({ code: 500, message: err.message })
})

export default router

// 导出供其他服务调用
/**
 * 简单中文分词：按字符 / 2字 / 3字 切分
 */
function tokenize(q) {
  const kws = []
  // 整句
  if (q.length >= 2) kws.push(q)
  // 3 字 token（中文常用）
  for (let i = 0; i <= q.length - 3; i++) kws.push(q.slice(i, i + 3))
  // 2 字 token
  for (let i = 0; i <= q.length - 2; i++) kws.push(q.slice(i, i + 2))
  // 1 字 token
  for (let i = 0; i < q.length; i++) kws.push(q[i])
  // 去重
  return [...new Set(kws)].filter(k => k.length >= 1)
}

export function searchKnowledge(q, limit = 3) {
  const raw = String(q || '').toLowerCase().trim()
  if (!raw) return []
  // 去除停用词
  const stopWords = ['怎么', '如何', '怎么办', '应该', '需要', '什么', '为什么', '这个', '那个', '吗', '呢', '啊', '吧']
  const filtered = stopWords.reduce((s, w) => s.replaceAll(w, ' '), raw)
  const tokens = tokenize(filtered)
  const docs = Array.from(knowledgeIndex.values())

  // 1. 知识库 hit（关键词 score + 预计算 embedding 权威度 boost）
  const docHits = docs.map(d => {
    let score = 0
    const title = (d.title || '').toLowerCase()
    const desc = (d.desc || '').toLowerCase()
    const docContent = (d.content || '').toLowerCase()
    if (title.includes(raw)) score += 10
    if ((d.cat || '').toLowerCase().includes(raw)) score += 5
    if (desc.includes(raw)) score += 3
    if (docContent.includes(raw)) score += 2
    for (const t of tokens) {
      if (t.length < 2) continue
      if (title.includes(t)) score += 3
      if (docContent.includes(t)) score += 1
    }
    // 🆕 语义权威度 boost：有预计算 embedding + 长内容 = 更高分
    if (docEmbeddings.has(d.id) && docContent.length > 200) {
      score += 1.5
    }
    return {
      id: d.id,
      title: d.title,
      cat: d.cat,
      score,
      excerpt: extractExcerpt(d.content || d.desc || d.title, tokens[0] || raw, 300),
      _type: 'doc'
    }
  }).filter(h => h.score > 0)

  // 2. 🆕 经验案例 hit（高 success_rate 加权）
  const caseHits = searchCases(raw, limit).map(c => ({
    id: c.id,
    title: '📊 ' + c.summary,
    cat: '历史经验',
    score: c.score,
    excerpt: (c.actions || []).join('\n') || c.summary,
    success_rate: c.success_rate,
    cityId: c.cityId,
    createdAt: c.createdAt,
    _type: 'case'
  }))

  // 合并：知识库 + 经验案例，按 score 排序
  return [...docHits, ...caseHits]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function getKnowledgeContext(query) {
  const results = searchKnowledge(query, 3)
  if (results.length === 0) return ''
  let ctx = '\n【运营知识库 + 历史经验】以下是检索到的参考资料（已根据问题自动检索）：\n'
  for (const r of results) {
    if (r._type === 'case') {
      const sr = Math.round((r.success_rate || 0) * 100)
      ctx += `📊 [历史经验 ${sr}%] ${r.title}\n   摘要: ${(r.excerpt || '').slice(0, 200)}\n`
    } else {
      ctx += `📄 [${r.cat || '其他'}] ${r.title}\n   ${(r.excerpt || '').slice(0, 200)}\n`
    }
  }
  ctx += '\n'
  return ctx
}

/**
 * 检索并返回结构化结果（供 decision 路由用）
 */
export function retrieveKnowledge(query, limit = 3) {
  return searchKnowledge(query, limit)
}
