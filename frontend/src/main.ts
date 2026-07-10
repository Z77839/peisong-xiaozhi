import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import * as ElIcons from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './assets/styles/index.scss'

const app = createApp(App)

// Pinia + 持久化
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(router)

// Element Plus
app.use(ElementPlus, { locale: zhCn, size: 'default' })

// 全局注册图标（按需使用更友好，但演示项目全部可用）
for (const [name, comp] of Object.entries(ElIcons)) {
  app.component(name, comp as any)
}

app.mount('#app')
