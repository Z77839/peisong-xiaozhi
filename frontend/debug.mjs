import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
})

// 注入 localStorage（在页面加载前执行）
await context.addInitScript(() => {
  localStorage.setItem('jiuxiaozhi-user', JSON.stringify({
    token: 'mock-token-demo',
    userInfo: { id: 'u_001', username: 'admin', nickname: '系统管理员', avatar: '', role: 'admin', org: '九小智运营中心' }
  }))
})

const page = await context.newPage()
page.on('console', msg => console.log('[BROWSER]', msg.text()))
page.on('pageerror', err => console.log('[ERROR]', err.message))

await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'load' })
await page.waitForTimeout(3500)

// 检查 localStorage
const ls = await page.evaluate(() => ({
  token: localStorage.getItem('jiuxiaozhi-auth-token'),
  user: localStorage.getItem('jiuxiaozhi-user')
}))
console.log('LocalStorage:', ls)

// 检查 DOM
const dom = await page.evaluate(() => ({
  url: window.location.hash,
  title: document.title,
  bodyText: document.body.innerText.slice(0, 200),
  hasMainLayout: !!document.querySelector('.main-layout'),
  hasLoginForm: !!document.querySelector('.login-page')
}))
console.log('DOM:', dom)

await browser.close()
