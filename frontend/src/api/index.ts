import request from './request'

export const dashboardApi = {
  getKpi: () => request.get('/dashboard/kpi'),
  getTrend: () => request.get('/dashboard/trend'),
  getHeatmap: () => request.get('/dashboard/heatmap')
}

export const orderApi = {
  predict: (params: any) => request.post('/order/predict', params),
  list: (params: any) => request.get('/order/list', { params })
}

export const riderApi = {
  analyze: (params: any) => request.post('/rider/analyze', params),
  list: (params: any) => request.get('/rider/list', { params })
}

export const costApi = {
  analyze: (params: any) => request.post('/cost/analyze', params),
  breakdown: () => request.get('/cost/breakdown')
}

export const merchantApi = {
  health: () => request.get('/merchant/health'),
  detail: (id: string) => request.get(`/merchant/${id}`)
}

export const reportApi = {
  generate: (params: any) => request.post('/report/generate', params),
  exportPDF: (id: string) => request.get(`/report/export/${id}`, { responseType: 'blob' })
}

export const decisionApi = {
  recommend: (params: any) => request.post('/decision/recommend', params),
  history: () => request.get('/decision/history'),
  // 🆕 派单/告警模块回写决策执行结果
  feedback: (params: { decisionId: string; dispatchId?: string; alertId?: string; result: 'success' | 'failed' | 'partial'; message?: string; riderCount?: number }) =>
    request.post('/decision/feedback', params),
  // 🆕 按 ID 取单条决策详情（用于从告警/派单回跳）
  getById: (id: string) => request.get(`/decision/${encodeURIComponent(id)}`)
}

// 🆕 派单模块回写
export const dispatchApi = {
  execute: (params: { cityId: string; orderId: string; riderId: string; decisionId?: string }) =>
    request.post('/dispatch/execute', params)
}

export const knowledgeApi = {
  list: () => request.get('/knowledge/list'),
  upload: (data: FormData) => request.post('/knowledge/upload', data)
}
