// 抓取交互演示截图：AI 流程 + 决策中心运行
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

async function setupAuth(context) {
  await context.addInitScript(() => {
    localStorage.setItem('jiuxiaozhi-user', JSON.stringify({
      token: 'mock-token-demo',
      userInfo: { id: 'u_001', username: 'admin', nickname: '系统管理员', avatar: '', role: 'admin', org: '九小智运营中心' }
    }))
  })
}

async function main() {
  await mkdir('/workspace/jiuxiaozhi-ai-platform/screenshots', { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  // 1. AI 流程演示
  console.log('🤖 AI 流程运行截图...')
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      locale: 'zh-CN'
    })
    await setupAuth(ctx)
    const page = await ctx.newPage()
    await page.goto('http://localhost:5173/#/chat', { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3500)
    // 找到一个 textarea 然后输入
    const ta = page.locator('textarea').first()
    await ta.scrollIntoViewIfNeeded()
    await ta.fill('预测今晚蒸湘万达商圈的运力缺口，并给出最经济的调度方案')
    await page.click('.send-btn')
    // 等流式输出
    await page.waitForTimeout(2500)
    await page.screenshot({
      path: '/workspace/jiuxiaozhi-ai-platform/screenshots/chat-running.png',
      fullPage: true
    })
    console.log('  ✓ chat-running.png (运行中)')
    // 等完成
    await page.waitForTimeout(8000)
    await page.screenshot({
      path: '/workspace/jiuxiaozhi-ai-platform/screenshots/chat-done.png',
      fullPage: true
    })
    console.log('  ✓ chat-done.png (完成)')
    await ctx.close()
  }

  // 2. 决策中心运行
  console.log('🎯 决策中心运行截图...')
  {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1.5,
      locale: 'zh-CN'
    })
    await setupAuth(ctx)
    const page = await ctx.newPage()
    await page.goto('http://localhost:5173/#/decision', { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3500)
    await page.click('button.run-btn')
    await page.waitForTimeout(3500)
    await page.screenshot({
      path: '/workspace/jiuxiaozhi-ai-platform/screenshots/decision-running.png',
      fullPage: true
    })
    console.log('  ✓ decision-running.png (运行中)')
    await page.waitForTimeout(5000)
    await page.screenshot({
      path: '/workspace/jiuxiaozhi-ai-platform/screenshots/decision-done.png',
      fullPage: true
    })
    console.log('  ✓ decision-done.png (完成)')
    await ctx.close()
  }

  await browser.close()
  console.log('\n✅ 完成')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
