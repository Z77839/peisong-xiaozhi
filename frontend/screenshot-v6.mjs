// v6 截图
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    locale: 'zh-CN'
  })
  await ctx.addInitScript(() => {
    localStorage.setItem('jiuxiaozhi-user', JSON.stringify({
      token: 'mock-token',
      userInfo: { id: 'u_001', username: 'admin', nickname: '系统管理员', avatar: '', role: 'admin', org: '浙江九颂河山' }
    }))
  })

  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'load' })
  await page.waitForTimeout(4500)

  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v6/dashboard.png',
    fullPage: true
  })
  console.log('✓ dashboard.png')

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})