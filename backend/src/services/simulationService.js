/**
 * 仿真回放服务
 *
 * 场景：衡阳 17:00 - 21:00 晚高峰
 * 演示「配送小智如何从被动响应升级为主动预防」
 *
 * 时间轴事件：
 * 17:00 - 起始状态（订单 800/min，缺口 320）
 * 17:30 - 缺口涨至 800，运力预判 Agent 触发预警
 * 18:00 - 缺口涨至 2100，配送小智启用高峰补贴
 * 18:15 - 补贴生效，缺口降回 1300
 * 18:30 - 第二波订单，缺口涨至 1800，跨区调拨 80 名
 * 19:00 - 调拨到位，缺口稳定在 600
 * 19:30 - 蜂跑运力到位，缺口降至 300
 * 20:00 - 高峰回落，缺口 200
 * 21:00 - 高峰结束，缺口 0
 */

const SIM_TIMELINE = [
  { time: '17:00', orders: 800, gap: 320, riders: 480, online: 480, action: null, alertLevel: 'low', agent: null, message: '基线状态 · 配送小智开始持续监控' },
  { time: '17:30', orders: 1200, gap: 800, riders: 480, online: 480, action: null, alertLevel: 'medium', agent: '运力预判 Agent', message: '检测到缺口上升 → 触发主动预警' },
  { time: '18:00', orders: 2100, gap: 2100, riders: 480, online: 460, action: 'subsidy', alertLevel: 'high', agent: '天气风险 Agent', message: '⚠️ 晚高峰 + 雨天叠加 · 建议启用高峰补贴' },
  { time: '18:15', orders: 1900, gap: 1300, riders: 480, online: 470, action: 'subsidy_done', alertLevel: 'medium', agent: '调度执行 Agent', message: '✅ 高峰补贴已生效 (¥18,000)，缺口回落 38%' },
  { time: '18:30', orders: 2200, gap: 1800, riders: 480, online: 480, action: 'transfer', alertLevel: 'high', agent: '运力预判 Agent', message: '⚠️ 第二波订单到达，建议跨区调拨 80 名' },
  { time: '19:00', orders: 1600, gap: 600, riders: 560, online: 540, action: 'transfer_done', alertLevel: 'medium', agent: '调度执行 Agent', message: '✅ 80 名跨区骑手到位，缺口降 67%' },
  { time: '19:30', orders: 1200, gap: 300, riders: 600, online: 580, action: 'boost', alertLevel: 'low', agent: '运力预判 Agent', message: '🚀 蜂跑运力到位 120 名，缺口进一步收缩' },
  { time: '20:00', orders: 800, gap: 200, riders: 600, online: 560, action: null, alertLevel: 'low', agent: '预警监控 Agent', message: '高峰回落 · 配送小智持续监控' },
  { time: '21:00', orders: 400, gap: 0, riders: 600, online: 480, action: 'finish', alertLevel: 'low', agent: '配送小智 · 总结', message: '✨ 高峰平稳度过 · 总成本节省 ¥42,000' }
]

// 当前仿真进度
let simState = {
  currentIdx: 0,
  isPlaying: false,
  autoInterval: null,
  startedAt: Date.now()
}

function getCurrent() {
  const snapshot = SIM_TIMELINE[simState.currentIdx] || SIM_TIMELINE[0]
  // 计算相对进度
  const progress = simState.currentIdx / (SIM_TIMELINE.length - 1)
  const totalGap = SIM_TIMELINE.reduce((s, t) => s + t.gap, 0)
  const peakGap = Math.max(...SIM_TIMELINE.map((t) => t.gap))
  const totalCostSaved = Math.round(42000 * (1 - peakGap / 2100)) // 估算节省
  return {
    snapshot,
    index: simState.currentIdx,
    totalSteps: SIM_TIMELINE.length,
    progress,
    peakGap,
    isPlaying: simState.isPlaying,
    // 累计事件
    eventsTriggered: SIM_TIMELINE.slice(0, simState.currentIdx + 1).filter((t) => t.action).length,
    timeline: SIM_TIMELINE
  }
}


/**
 * GET /api/simulation/state
 */
export function getSimulationState(req, res) {
  try {
    res.json({ code: 0, data: getCurrent() })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
}

/**
 * POST /api/simulation/control
 * body: { action: 'play'|'pause'|'next'|'prev'|'reset'|'goto', step?: number }
 */
export function controlSimulation(req, res) {
  try {
    const { action, step } = req.body || {}
    if (action === 'play') {
      simState.isPlaying = true
      if (!simState.autoInterval) {
        simState.autoInterval = setInterval(() => {
          if (simState.currentIdx < SIM_TIMELINE.length - 1) {
            simState.currentIdx++
          } else {
            // 到末尾停止
            simState.isPlaying = false
            clearInterval(simState.autoInterval)
            simState.autoInterval = null
          }
        }, 1500)
      }
    } else if (action === 'pause') {
      simState.isPlaying = false
      if (simState.autoInterval) {
        clearInterval(simState.autoInterval)
        simState.autoInterval = null
      }
    } else if (action === 'next') {
      if (simState.currentIdx < SIM_TIMELINE.length - 1) simState.currentIdx++
    } else if (action === 'prev') {
      if (simState.currentIdx > 0) simState.currentIdx--
    } else if (action === 'reset') {
      simState.currentIdx = 0
      simState.isPlaying = false
      if (simState.autoInterval) {
        clearInterval(simState.autoInterval)
        simState.autoInterval = null
      }
    } else if (action === 'goto' && typeof step === 'number') {
      simState.currentIdx = Math.max(0, Math.min(step, SIM_TIMELINE.length - 1))
    }
    res.json({ code: 0, data: getCurrent() })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
}

export function getTimeline() {
  return SIM_TIMELINE
}