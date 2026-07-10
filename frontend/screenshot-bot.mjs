// 截图悬浮机器人
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

async function main() {
  await mkdir('/workspace/jiuxiaozhi-ai-platform/screenshots-v3', { recursive: true })

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

  // Dashboard + 悬浮按钮收起状态
  await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v3/01-dashboard-with-fab.png',
    fullPage: false
  })
  console.log('✓ 01-dashboard-with-fab.png')

  // 点击 FAB，弹出窗口
  await page.click('.chatbot-fab')
  await page.waitForTimeout(800)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v3/02-chatbot-opened.png',
    fullPage: false
  })
  console.log('✓ 02-chatbot-opened.png')

  // 点击推荐问题
  await page.click('.sug-pill:nth-child(1)')
  await page.waitForTimeout(3500)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v3/03-chatbot-typing.png',
    fullPage: false
  })
  console.log('✓ 03-chatbot-typing.png')

  // 等 AI 完整回复
  await page.waitForTimeout(8000)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v3/04-chatbot-answer.png',
    fullPage: false
  })
  console.log('✓ 04-chatbot-answer.png')

  // 关闭
  await page.click('.chatbot-window .cb-action:nth-child(2)')

  // 切到运力线页确认 FAB 还在
  await page.goto('http://localhost:5173/#/rider-types', { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v3/05-rider-types-with-fab.png',
    fullPage: false
  })
  console.log('✓ 05-rider-types-with-fab.png')

  // 切到决策中心
  await page.goto('http://localhost:5173/#/decision', { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  await page.click('.chatbot-fab')
  await page.waitForTimeout(800)
  await page.screenshot({
    path: '/workspace/jiuxiaozhi-ai-platform/screenshots-v3/06-decision-with-bot.png',
    fullPage: false
  })
  console.log('✓ 06-decision-with-bot.png')

  await browser.close()
  console.log('\n✅ 完成')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
