#!/usr/bin/env node
// 配送小智 · Smoke Test
//
// 用法：
//   1) 启动本地后端：cd backend && npm run dev
//   2) 跑 smoke test：
//        node scripts/smoke-test.mjs                # 默认测 http://localhost:3000
//        node scripts/smoke-test.mjs https://peisong-backend.onrender.com
//
// 输出：
//   每个用例一行 [PASS]/[FAIL]，含 HTTP 码 + 耗时；最后一行汇总。
//   任何用例失败退出码 = 1（CI 可用），全部通过退出码 = 0。

const BASE = (process.argv[2] || process.env.SMOKE_BASE || 'http://localhost:3000').replace(/\/+$/, '')

const cases = [
  { name: 'GET  /api/health',         method: 'GET',  path: '/api/health' },
  { name: 'POST /api/auth/login (admin/admin@2024)', method: 'POST', path: '/api/auth/login', body: { account: 'admin', password: 'admin@2024' }, expect: (j) => j && j.data && j.data.token },
  { name: 'GET  /api/dashboard',      method: 'GET',  path: '/api/dashboard', auth: true },
  { name: 'GET  /api/riders/capacity', method: 'GET', path: '/api/riders/capacity' },
  { name: 'POST /api/decision/run',   method: 'POST', path: '/api/decision/run', body: { query: '预测今晚衡阳各商圈订单量', cityId: 'hengyang' }, timeoutMs: 60_000 },
  { name: 'GET  /api/decision/history', method: 'GET', path: '/api/decision/history', auth: true },
  { name: 'POST /api/dispatch/execute (with decisionId)', method: 'POST', path: '/api/dispatch/execute', body: { orderId: 'o-smoke-1', riderId: 'r-smoke-1', decisionId: 'd_smoke_test' } },
  { name: 'POST /api/decision/feedback (with dispatchId)', method: 'POST', path: '/api/decision/feedback', body: { decisionId: 'd_smoke_test', dispatchId: 'dp_smoke_1', result: 'success', message: 'smoke test', riderCount: 1 } }
]

let token = ''
let pass = 0
let fail = 0

function pad(s, n) { return (s + ' '.repeat(n)).slice(0, n) }

async function runOne(c) {
  const start = Date.now()
  const url = BASE + c.path
  const headers = { 'Content-Type': 'application/json' }
  if (c.auth && token) headers.Authorization = 'Bearer ' + token
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), c.timeoutMs || 30_000)
  try {
    const resp = await fetch(url, {
      method: c.method,
      headers,
      body: c.body ? JSON.stringify(c.body) : undefined,
      signal: ctrl.signal
    })
    clearTimeout(to)
    const ms = Date.now() - start
    const text = await resp.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    const httpOk = resp.status >= 200 && resp.status < 300
    const contractOk = !c.expect || c.expect(json)
    if (httpOk && contractOk) {
      // 顺手把 login 的 token 存起来
      if (c.path === '/api/auth/login' && json?.data?.token) token = json.data.token
      pass++
      console.log(`[PASS] ${pad(c.name, 50)} HTTP ${resp.status}  ${ms}ms`)
    } else {
      fail++
      console.log(`[FAIL] ${pad(c.name, 50)} HTTP ${resp.status}  ${ms}ms`)
      if (text && text.length < 500) console.log('       body: ' + text)
    }
  } catch (e) {
    clearTimeout(to)
    const ms = Date.now() - start
    fail++
    console.log(`[FAIL] ${pad(c.name, 50)} ${e.name} ${ms}ms`)
    console.log('       err: ' + (e.message || e))
  }
}

console.log('========================================')
console.log(`Smoke Test → ${BASE}`)
console.log('========================================')

for (const c of cases) {
  await runOne(c)
}

console.log('----------------------------------------')
console.log(`PASS: ${pass}  FAIL: ${fail}  TOTAL: ${pass + fail}`)
console.log('========================================')
process.exit(fail === 0 ? 0 : 1)
