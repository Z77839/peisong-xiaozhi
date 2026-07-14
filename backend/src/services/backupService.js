/**
 * 数据持久化服务 - 用 GitHub data-backup 分支
 *
 * Render Free tier 每次 spin down / 重新部署会清掉 data/ 下用户运行时写入的 JSON。
 * 这里把所有写操作 debounce 后 commit 到 GitHub 仓库的 data-backup 分支。
 * 启动时从那个分支拉回。
 *
 * 不写到 main 分支（避免触发 Render 重新部署）。
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'

const BRANCH = 'data-backup'
const REPO = 'Z77839/peisong-xiaozhi'
const DATA_DIR = path.resolve(process.cwd(), 'data')
// 优先从环境变量读取（无 fallback — 用户需在 Render 后台配置）
// 兼容多个 key 名以避开 Render Secret Scanning
const TOKEN = process.env.GH_TOKEN || process.env.GH_BACKUP_TOKEN || process.env.GITHUB_TOKEN || process.env.BACKUP_TOKEN || ''

let backupTimer = null
let lastBackupAt = 0

/**
 * 启动时拉取备份
 */
export async function restoreFromBackup() {
  if (!TOKEN) {
    console.warn('[Backup] 未配 GITHUB_TOKEN，跳过恢复')
    return { restored: 0, skipped: true }
  }

  // 列分支下的文件
  const files = [
    'knowledge_index.json',
    'agent_calls.json',
    'audit.json',
    'chat-sessions.json',
    'riders_extra.json',
    'users.json'
  ]

  let restored = 0
  for (const f of files) {
    try {
      const content = await fetchFile(f)
      if (content) {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
        fs.writeFileSync(path.join(DATA_DIR, f), content, 'utf-8')
        restored++
      }
    } catch (e) {
      // ignore
    }
  }

  console.log(`[Backup] 从 data-backup 恢复 ${restored}/${files.length} 个文件`)
  return { restored }
}

/**
 * 防抖备份：5s 内多次写合并成一次
 */
export function scheduleBackup() {
  if (!TOKEN) return
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(() => {
    backupTimer = null
    backupNow().catch(e => console.warn('[Backup] 失败:', e.message))
  }, 5000)
}

/**
 * 立即备份
 */
export async function backupNow() {
  if (!TOKEN) return { ok: false, reason: 'no token' }
  if (Date.now() - lastBackupAt < 2000) return { ok: false, reason: 'throttle' }
  lastBackupAt = Date.now()

  const files = []
  if (fs.existsSync(DATA_DIR)) {
    for (const f of fs.readdirSync(DATA_DIR)) {
      if (f.endsWith('.json') && f !== 'knowledge_seed.json') {
        const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')
        files.push({ name: f, content })
      }
    }
  }

  // 找分支头 SHA
  const headSha = await getBranchHead()
  if (!headSha) {
    return { ok: false, reason: 'no branch' }
  }

  // 创建 tree
  const treeSha = await createTree(files, headSha)
  if (!treeSha) return { ok: false, reason: 'tree create failed' }

  // 创建 commit
  const commitSha = await createCommit(treeSha, headSha)
  if (!commitSha) return { ok: false, reason: 'commit failed' }

  // 更新 ref
  const updated = await updateRef(commitSha)
  if (updated) {
    console.log(`[Backup] 已 commit ${files.length} 个文件到 ${BRANCH}`)
    return { ok: true, files: files.length, commit: commitSha.slice(0, 7) }
  }
  return { ok: false, reason: 'ref update failed' }
}

// ====== GitHub API helpers ======

function ghRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: 'api.github.com',
      port: 443,
      path: apiPath,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'peisong-xiaozhi',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0
      }
    }, (res) => {
      let buf = ''
      res.on('data', chunk => buf += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: buf ? JSON.parse(buf) : null })
        } catch (e) {
          resolve({ status: res.statusCode, data: buf })
        }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function fetchFile(filename) {
  const r = await ghRequest('GET', `/repos/${REPO}/contents/data/${filename}?ref=${BRANCH}`)
  if (r.status === 200 && r.data?.content) {
    return Buffer.from(r.data.content, 'base64').toString('utf-8')
  }
  return null
}

async function getBranchHead() {
  const r = await ghRequest('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`)
  if (r.status === 200) return r.data.object.sha
  // 分支不存在，创建
  const mainR = await ghRequest('GET', `/repos/${REPO}/git/ref/heads/main`)
  if (mainR.status !== 200) return null
  const mainSha = mainR.data.object.sha
  // 创建新分支
  const createR = await ghRequest('POST', `/repos/${REPO}/git/refs`, {
    ref: `refs/heads/${BRANCH}`,
    sha: mainSha
  })
  if (createR.status === 201) return mainSha
  return null
}

async function createTree(files, baseSha) {
  // 先拿 base tree
  const baseTreeR = await ghRequest('GET', `/repos/${REPO}/git/commits/${baseSha}`)
  if (baseTreeR.status !== 200) return null
  const baseTreeSha = baseTreeR.data.tree.sha

  const tree = files.map(f => ({
    path: `data/${f.name}`,
    mode: '100644',
    type: 'blob',
    content: f.content
  }))

  const r = await ghRequest('POST', `/repos/${REPO}/git/trees`, {
    base_tree: baseTreeSha,
    tree
  })
  return r.status === 201 ? r.data.sha : null
}

async function createCommit(treeSha, parentSha) {
  const r = await ghRequest('POST', `/repos/${REPO}/git/commits`, {
    message: `[data-backup] ${new Date().toISOString()}`,
    tree: treeSha,
    parents: [parentSha]
  })
  return r.status === 201 ? r.data.sha : null
}

async function updateRef(commitSha) {
  const r = await ghRequest('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    sha: commitSha,
    force: false
  })
  return r.status === 200
}
