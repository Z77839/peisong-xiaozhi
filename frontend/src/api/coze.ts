/**
 * 配送小智 · 后端代理的 Coze 工作流
 * 前端 → /api/decision/run → 后端 → 真 Coze（或 Mock）
 *
 * 优势：Bot ID / API Key 不暴露给前端
 */

import request from './request'

export interface AgentStep {
  id: string
  name: string
  desc?: string
  icon?: string
  status: 'pending' | 'running' | 'success' | 'error'
  startedAt?: number
  finishedAt?: number
  output?: string
}

export interface AgentRunResult {
  predicted_orders?: number
  trend?: 'upward' | 'downward' | 'stable'
  rider_suggestion?: string
  cost_estimate?: number
  strategy?: string
  risk_level?: 'low' | 'medium' | 'high'
  report?: string
  steps: AgentStep[]
  coze_used?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * 调用后端决策流接口
 */
export async function runMultiAgentWorkflow(query: string): Promise<AgentRunResult> {
  const data: any = await request({
    url: '/decision/run',
    method: 'POST',
    data: { query }
  })
  return data as AgentRunResult
}

/**
 * 流式输出（SSE）
 */
export async function streamMultiAgentWorkflow(
  query: string,
  onStep: (step: AgentStep) => void,
  onReport: (chunk: string) => void,
  onDone: (result: AgentRunResult) => void
) {
  // 直接同步拉取，再用前端模拟流式
  const result = await runMultiAgentWorkflow(query)

  for (const step of result.steps) {
    onStep(step)
    await delay(300)
  }

  if (result.report) {
    const chunks = chunkString(result.report, 12)
    for (const c of chunks) {
      onReport(c)
      await delay(30)
    }
  }

  onDone(result)
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function chunkString(s: string, n: number) {
  const out: string[] = []
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n))
  return out
}

export default {
  runMultiAgentWorkflow,
  streamMultiAgentWorkflow
}
