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
  history: () => request.get('/decision/history')
}

export const knowledgeApi = {
  list: () => request.get('/knowledge/list'),
  upload: (data: FormData) => request.post('/knowledge/upload', data)
}
