<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { streamMultiAgentWorkflow, type AgentRunResult } from '@/api/coze'
import { useCityStore } from '@/store/city'
import { formatNumber } from '@/utils/format'

const cityStore = useCityStore()

// 展开状态
const visible = ref(false)
const expanded = ref(true)
const unread = ref(0)
const inputText = ref('')
const streaming = ref(false)

interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
  steps?: { name: string; status: 'running' | 'success' }[]
  result?: AgentRunResult
  timestamp: number
}

const messages = ref<Msg[]>([
  {
    id: 'welcome',
    role: 'assistant',
    content:
      `👋 你好！我是配送小智 AI 助手\n\n📍 当前城市：${cityStore.currentCity.name}\n\n随时问我：\n• 今日订单预测\n• 运力调度建议\n• 蜂跑成本对比\n• C 端增长方案`,
    timestamp: Date.now()
  }
])

const messagesArea = ref<HTMLElement | null>(null)

const suggestions = [
  '衡阳晚高峰蜂跑运力是否扩容？',
  '专送和优选哪个 ROI 高？',
  '蒸湘区团长激活建议',
  '今日预计节省多少成本？'
]

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesArea.value) {
      messagesArea.value.scrollTop = messagesArea.value.scrollHeight
    }
  })
}

const toggle = () => {
  visible.value = !visible.value
  if (visible.value) {
    expanded.value = true
    unread.value = 0
    scrollToBottom()
  }
}

const send = async (text?: string) => {
  const content = (text ?? inputText.value).trim()
  if (!content || streaming.value) return
  inputText.value = ''

  const userMsg: Msg = {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    timestamp: Date.now()
  }
  messages.value.push(userMsg)
  scrollToBottom()

  const assistantMsg: Msg = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    steps: [],
    timestamp: Date.now()
  }
  messages.value.push(assistantMsg)
  streaming.value = true

  try {
    await streamMultiAgentWorkflow(
      content,
      (step) => {
        if (!assistantMsg.steps) assistantMsg.steps = []
        const exist = assistantMsg.steps.findIndex((s) => s.name === step.name)
        if (exist >= 0) assistantMsg.steps[exist] = { name: step.name, status: step.status as any }
        else assistantMsg.steps.push({ name: step.name, status: step.status as any })
        scrollToBottom()
      },
      (chunk) => {
        assistantMsg.content += chunk
        scrollToBottom()
      },
      (result) => {
        assistantMsg.result = result
        streaming.value = false
        scrollToBottom()
        if (!visible.value || !expanded.value) {
          unread.value++
        }
      }
    )
  } catch (e) {
    assistantMsg.content = '抱歉，处理时出错了，请稍后再试。'
    streaming.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <div class="chatbot-root">
    <!-- 悬浮按钮 -->
    <transition name="fab-bounce">
      <div v-if="!visible" class="chatbot-fab" @click="toggle">
        <el-badge :value="unread" v-if="unread > 0" :max="9" :offset="[-2, 2]">
          <div class="fab-icon">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <defs>
                <linearGradient id="fablg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#4080ff"/>
                  <stop offset="100%" stop-color="#1f6feb"/>
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="9" fill="url(#fablg)"/>
              <circle cx="16" cy="16" r="8" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.4"/>
              <circle cx="16" cy="16" r="3" fill="#fff"/>
            </svg>
          </div>
        </el-badge>
        <div v-else class="fab-icon">
          <svg viewBox="0 0 32 32" width="32" height="32">
            <defs>
              <linearGradient id="fablg2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#4080ff"/>
                <stop offset="100%" stop-color="#1f6feb"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill="url(#fablg2)"/>
            <path d="M9 11 L9 21 L13 21 L13 24 L18 21 L22 21 A2 2 0 0 0 24 19 L24 13 A2 2 0 0 0 22 11 Z" fill="#fff" opacity="0.95"/>
            <circle cx="14" cy="16" r="1.2" fill="#1f6feb"/>
            <circle cx="18" cy="16" r="1.2" fill="#1f6feb"/>
          </svg>
        </div>
        <div class="fab-pulse"></div>
      </div>
    </transition>

    <!-- 弹窗 -->
    <transition name="chat-fade">
      <div v-if="visible" class="chatbot-window">
        <!-- 头部 -->
        <div class="cb-header">
          <div class="cb-title-area">
            <div class="cb-avatar">
              <svg viewBox="0 0 32 32" width="28" height="28">
                <rect width="32" height="32" rx="8" fill="#fff" opacity="0.2"/>
                <text x="16" y="22" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">九</text>
              </svg>
            </div>
            <div>
              <div class="cb-title">配送小智 AI 助手</div>
              <div class="cb-status">
                <span class="status-dot"></span>
                {{ streaming ? '8 Agent 协同处理中...' : '已就绪 · ' + cityStore.currentCity.name }}
              </div>
            </div>
          </div>
          <div class="cb-actions">
            <button class="cb-action" @click="expanded = !expanded" :title="expanded ? '最小化' : '展开'">
              {{ expanded ? '—' : '+' }}
            </button>
            <button class="cb-action" @click="toggle" title="关闭">×</button>
          </div>
        </div>

        <template v-if="expanded">
          <!-- 消息区 -->
          <div ref="messagesArea" class="cb-messages">
            <div v-for="m in messages" :key="m.id" class="msg-row" :class="`msg-${m.role}`">
              <div v-if="m.role === 'assistant'" class="msg-avatar">
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <rect width="32" height="32" rx="8" fill="#1f6feb"/>
                  <text x="16" y="22" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">九</text>
                </svg>
              </div>

              <div class="msg-bubble">
                <!-- Agent 步骤 -->
                <div v-if="m.steps && m.steps.length" class="mini-steps">
                  <div
                    v-for="(s, i) in m.steps"
                    :key="i"
                    class="mini-step"
                    :class="`ms-${s.status}`"
                  >
                    <span class="ms-icon">{{ s.status === 'success' ? '✓' : s.status === 'running' ? '◐' : '○' }}</span>
                    {{ s.name }}
                  </div>
                </div>

                <!-- 文本（支持换行） -->
                <div class="msg-text" v-if="m.content">{{ m.content }}</div>

                <!-- 结果指标 -->
                <div v-if="m.result && !streaming" class="mini-result">
                  <div class="mr-item">
                    <span class="mr-label">预测订单</span>
                    <span class="mr-value">{{ formatNumber(m.result.predicted_orders || 0) }}</span>
                  </div>
                  <div class="mr-item">
                    <span class="mr-label">节省</span>
                    <span class="mr-value">¥{{ formatNumber(m.result.cost_estimate || 0) }}</span>
                  </div>
                </div>
              </div>

              <div v-if="m.role === 'user'" class="msg-avatar user-avatar">U</div>
            </div>
          </div>

          <!-- 推荐 -->
          <div v-if="messages.length === 1 && !streaming" class="cb-suggestions">
            <div v-for="s in suggestions" :key="s" class="sug-pill" @click="send(s)">{{ s }}</div>
          </div>

          <!-- 输入 -->
          <div class="cb-input-area">
            <el-input
              v-model="inputText"
              type="textarea"
              :rows="1"
              :autosize="{ minRows: 1, maxRows: 3 }"
              placeholder="问问配送小智..."
              :disabled="streaming"
              @keydown="handleKeydown"
            />
            <button class="cb-send" :disabled="streaming || !inputText.trim()" @click="send()">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M2 21 L23 12 L2 3 L2 10 L17 12 L2 14 Z" fill="#fff"/>
              </svg>
            </button>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
