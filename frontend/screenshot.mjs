// 截图所有关键页面 - 每次新页面 + 注入 token
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

async function main() {
  await mkdir('/workspace/jiuxiaozhi-ai-platform/screenshots', { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const targets = [
    { url: '#/login', name: 'login', desc: '登录页', needAuth: false },
    { url: '#/dashboard', name: 'dashboard', desc: 'Dashboard', needAuth: true },
    { url: '#/chat', name: 'chat', desc: 'AI 智能问答', needAuth: true },
    { url: '#/decision', name: 'decision', desc: '决策中心', needAuth: true },
    { url: '#/order', name: 'order', desc: '订单预测', needAuth: true },
    { url: '#/rider', name: 'rider', desc: '运力分析', needAuth: true },
    { url: '#/cost', name: 'cost', desc: '成本分析', needAuth: true },
    { url: '#/merchant', name: 'merchant', desc: '商户健康度', needAuth: true },
    { url: '#/report', name: 'report', desc: '运营报告', needAuth: true },
    { url: '#/knowledge', name: 'knowledge', desc: '知识库', needAuth: true },
    { url: '#/setting', name: 'setting', desc: '系统设置', needAuth: true }
  ]

  for (const t of targets) {
    console.log(`📸 ${t.desc}...`)
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      locale: 'zh-CN'
    })

    if (t.needAuth) {
      await context.addInitScript(() => {
        localStorage.setItem('jiuxiaozhi-user', JSON.stringify({
          token: 'mock-token-demo',
          userInfo: { id: 'u_001', username: 'admin', nickname: '系统管理员', avatar: '', role: 'admin', org: '九小智运营中心' }
        }))
      })
    }

    const page = await context.newPage()
    await page.goto(`http://localhost:5173/${t.url}`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3500)
    await page.screenshot({
      path: `/workspace/jiuxiaozhi-ai-platform/screenshots/${t.name}.png`,
      fullPage: true
    })
    await context.close()
    console.log(`  ✓ ${t.name}.png`)
  }

  await browser.close()
  console.log('\n✅ 全部完成')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
