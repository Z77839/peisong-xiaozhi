import { createRouter, createWebHashHistory } from 'vue-router'
import nprogress from 'nprogress'
import 'nprogress/nprogress.css'
import { useUserStore } from '@/store/user'

nprogress.configure({ showSpinner: false })

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', noAuth: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '运营总览', icon: 'DataAnalysis' }
      },
      {
        path: 'decision',
        name: 'Decision',
        component: () => import('@/views/decision/index.vue'),
        meta: { title: '决策中心', icon: 'Cpu' }
      },
      {
        path: 'rider-types',
        name: 'RiderTypes',
        component: () => import('@/views/rider-types/index.vue'),
        meta: { title: '运力线分析', icon: 'Van' }
      },
      {
        path: 'rider',
        name: 'Rider',
        component: () => import('@/views/rider/index.vue'),
        meta: { title: '骑手管理', icon: 'User' }
      },
      {
        path: 'order',
        name: 'Order',
        component: () => import('@/views/order/index.vue'),
        meta: { title: '订单分析', icon: 'TrendCharts' }
      },
      {
        path: 'cost',
        name: 'Cost',
        component: () => import('@/views/cost/index.vue'),
        meta: { title: '成本分析', icon: 'Money' }
      },
      {
        path: 'merchant',
        name: 'Merchant',
        component: () => import('@/views/merchant/index.vue'),
        meta: { title: '商户健康度', icon: 'Shop' }
      },
      {
        path: 'c-end',
        name: 'CEnd',
        component: () => import('@/views/c-end/index.vue'),
        meta: { title: 'C 端运营', icon: 'ChatLineSquare' }
      },
      {
        path: 'report',
        name: 'Report',
        component: () => import('@/views/report/index.vue'),
        meta: { title: '运营报告', icon: 'Document' }
      },
      {
        path: 'knowledge',
        name: 'Knowledge',
        component: () => import('@/views/knowledge/index.vue'),
        meta: { title: '知识库', icon: 'Files' }
      },
      {
        path: 'setting',
        name: 'Setting',
        component: () => import('@/views/setting/index.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      },
      {
        path: 'demo',
        name: 'Demo',
        component: () => import('@/views-v8-demo/App.vue'),
        meta: { title: 'AI 配送演示 (v8)', icon: 'MagicStick' }
      },
      {
        path: 'alert',
        name: 'AlertCenter',
        component: () => import('@/views/alert/index.vue'),
        meta: { title: '预警中心', icon: 'Warning' }
      },
      {
        path: 'dispatch',
        name: 'SmartDispatch',
        component: () => import('@/views/dispatch/index.vue'),
        meta: { title: '智能派单', icon: 'TakeawayBox' }
      },
      {
        path: 'simulation',
        name: 'Simulation',
        component: () => import('@/views/simulation/index.vue'),
        meta: { title: '仿真回放', icon: 'VideoPlay' }
      },
      {
        path: 'data-source',
        name: 'DataSource',
        component: () => import('@/views/data-source/index.vue'),
        meta: { title: '数据接入', icon: 'Connection' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/login/index.vue'),
    meta: { hidden: true }
  }
] 

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  nprogress.start()
  const userStore = useUserStore()
  document.title = `${to.meta.title || ''} · 配送小智`
  if (!to.meta.noAuth && !userStore.token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

router.afterEach(() => {
  nprogress.done()
})

export default router
