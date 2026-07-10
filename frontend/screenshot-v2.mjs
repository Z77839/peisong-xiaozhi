// v2 截图脚本 - 真实数据版
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

async function main() {
  await mkdir('/workspace/jiuxiaozhi-ai-platform/screenshots-v2', { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const targets = [
    { url: '#/login', name: 'login' },
    { url: '#/dashboard', name: 'dashboard' },
    { url: '#/rider-types', name: 'rider-types' },
    { url: '#/c-end', name: 'c-end' },
    { url: '#/order', name: 'order' },
    { url: '#/cost', name: 'cost' },
    { url: '#/rider', name: 'rider' },
    { url: '#/merchant', name: 'merchant' },
    { url: '#/decision', name: 'decision' },
    { url: '#/report', name: 'report' },
    { url: '#/knowledge', name: 'knowledge' },
    { url: '#/setting', name: 'setting' }
  ]

  for (const t of targets) {
    console.log(`📸 ${t.name}...`)
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      locale: 'zh-CN'
    })

    if (t.name !== 'login') {
      await ctx.addInitScript(() => {
        localStorage.setItem('jiuxiaozhi-user', JSON.stringify({
          token: 'mock-token-demo',
          userInfo: { id: 'u_001', username: 'admin', nickname: '系统管理员', avatar: '', role: 'admin', org: '浙江九颂河山' }
        }))
      })
    }

    const page = await ctx.newPage()
    await page.goto(`http://localhost:5173/${t.url}`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3500)
    await page.screenshot({
      path: `/workspace/jiuxiaozhi-ai-platform/screenshots-v2/${t.name}.png`,
      fullPage: true
    })
    await ctx.close()
    console.log(`  ✓ ${t.name}.png`)
  }

  // 决策中心运行截图
  console.log('🎯 decision-running...')
  {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1.5,
      locale: 'zh-CN'
    })
    await ctx.addInitScript(() => {
      localStorage.setItem('jiuxiaozhi-user', JSON.stringify({
        token: 'mock-token-demo',
        userInfo: { id: 'u_001', username: 'admin', nickname: '系统管理员', avatar: '', role: 'admin', org: '浙江九颂河山' }
      }))
    })
    const page = await ctx.newPage()
    await page.goto('http://localhost:5173/#/decision', { waitUntil: 'load' })
    await page.waitForTimeout(3000)
    await page.click('button.run-btn')
    await page.waitForTimeout(10000)
    await page.screenshot({
      path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v2/decision-done.png',
      fullPage: true
    })
    await ctx.close()
    console.log('  ✓ decision-done.png')
  }

  await browser.close()
  console.log('\n✅ 完成')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
