// v5 截图：Dashboard + 决策中心 + 决策中心运行后
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

async function main() {
  await mkdir('/workspace/jiuxiaozhi-ai-platform/screenshots-v5', { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const targets = [
    { url: '#/dashboard', name: 'dashboard', wait: 3500 },
    { url: '#/decision', name: 'decision', wait: 3000 }
  ]

  for (const t of targets) {
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
    await page.goto(`http://localhost:5173/${t.url}`, { waitUntil: 'load' })
    await page.waitForTimeout(t.wait)
    await page.screenshot({
      path: `/workspace/jiuxiaozhi-ai-platform/screenshots-v5/${t.name}.png`,
      fullPage: false
    })
    console.log(`✓ ${t.name}.png`)
    await ctx.close()
  }

  // 决策中心 - 展开工作流详情 + 提问运行
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
  await page.goto('http://localhost:5173/#/decision', { waitUntil: 'load' })
  await page.waitForTimeout(3000)

  // 展开工作流详情
  await page.click('button.flow-toggle')
  await page.waitForTimeout(800)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v5/decision-flow-expanded.png',
    fullPage: false
  })
  console.log('✓ decision-flow-expanded.png')

  // 输入问题后运行
  await page.fill('textarea.big-input', '预测今晚衡阳蒸湘万达商圈订单量')
  await page.waitForTimeout(500)
  await page.click('button.run-btn')
  await page.waitForTimeout(2500)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v5/decision-running.png',
    fullPage: false
  })
  console.log('✓ decision-running.png')

  // 等全部跑完
  await page.waitForTimeout(8000)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v5/decision-result.png',
    fullPage: true
  })
  console.log('✓ decision-result.png')

  await browser.close()
  console.log('\n✅ 完成')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
