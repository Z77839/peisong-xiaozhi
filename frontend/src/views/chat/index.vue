<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { streamMultiAgentWorkflow, type AgentStep, type AgentRunResult } from '@/api/coze'
import AgentStepCard from '@/components/AgentStep.vue'
import { formatNumber } from '@/utils/format'
import { renderMarkdown } from '@/utils/markdown'

const renderMd = (txt: string) => renderMarkdown(txt)
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  result?: AgentRunResult
  steps?: AgentStep[]
  thinking?: boolean
  timestamp: number
}

const messages = ref<Message[]>([])
const inputText = ref('')
const streaming = ref(false)
const messagesEnd = ref<HTMLElement | null>(null)
const chatArea = ref<HTMLElement | null>(null)
const inputArea = ref<HTMLElement | null>(null)

const suggestions = [
  '预测今晚蒸湘万达商圈的订单量',
  '分析当前运力缺口并给出调度方案',
  '计算今日的单均履约成本',
  '生成今天的完整运营报告',
  '识别风险商户并给出改进建议'
]

const scrollToBottom = () => {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

const sendMessage = async (text?: string) => {
  const content = (text ?? inputText.value).trim()
  if (!content || streaming.value) return

  inputText.value = ''
  const userMsg: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    timestamp: Date.now()
  }
  messages.value.push(userMsg)
  scrollToBottom()

  const assistantMsg: Message = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    steps: [],
    thinking: true,
    timestamp: Date.now()
  }
  messages.value.push(assistantMsg)
  scrollToBottom()

  streaming.value = true

  try {
    await streamMultiAgentWorkflow(
      content,
      (step) => {
        if (!assistantMsg.steps) assistantMsg.steps = []
        const existing = assistantMsg.steps.findIndex((s) => s.id === step.id)
        if (existing >= 0) assistantMsg.steps[existing] = step
        else assistantMsg.steps.push(step)
        scrollToBottom()
      },
      (chunk) => {
        assistantMsg.content += chunk
        scrollToBottom()
      },
      (result) => {
        assistantMsg.result = result
        assistantMsg.thinking = false
        streaming.value = false
        scrollToBottom()
      }
    )
  } catch (e) {
    assistantMsg.content = '抱歉，处理您的请求时出错。'
    assistantMsg.thinking = false
    streaming.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

onMounted(() => {
  // 自动注入一个欢迎消息
  messages.value.push({
    id: `system-${Date.now()}`,
    role: 'assistant',
    content:
      '您好！我是配送小智 AI 运营助手。\n\n我可以帮您：\n• 订单量预测与趋势分析\n• 运力缺口识别与调度建议\n• 成本结构拆解与优化方案\n• 多 Agent 协同决策与报告生成\n\n请告诉我您想了解什么？',
    timestamp: Date.now()
  })
})
</script>

<template>
  <div class="chat-page">
    <!-- 头部信息 -->
    <div class="chat-header">
      <div class="agent-info">
        <div class="agent-avatar">
          <svg viewBox="0 0 32 32" width="32" height="32">
            <rect width="32" height="32" rx="8" fill="#1f6feb"/>
            <path d="M9 10h3v5h8v-5h3v12h-3v-5h-8v5H9z" fill="#fff"/>
          </svg>
        </div>
        <div class="agent-meta">
          <div class="agent-name">配送小智 · AI 运营助手</div>
          <div class="agent-status">
            <span class="status-dot"></span>
            多 Agent 协同模式已就绪
          </div>
        </div>
      </div>
      <div class="header-actions">
        <el-tag type="success" effect="plain" round>GPT-4o · v2.6</el-tag>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="chatArea" class="chat-area">
      <div v-for="m in messages" :key="m.id" class="message-item" :class="`msg-${m.role}`">
        <!-- 用户消息 -->
        <template v-if="m.role === 'user'">
          <div class="msg-bubble user-bubble">{{ m.content }}</div>
          <div class="msg-avatar user-avatar">U</div>
        </template>

        <!-- AI 消息 -->
        <template v-else>
          <div class="msg-avatar ai-avatar">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <rect width="32" height="32" rx="8" fill="#1f6feb"/>
              <path d="M9 10h3v5h8v-5h3v12h-3v-5h-8v5H9z" fill="#fff"/>
            </svg>
          </div>
          <div class="msg-bubble ai-bubble">
            <!-- 思考过程：执行步骤 -->
            <div v-if="m.steps && m.steps.length" class="steps-block">
              <div class="steps-title">
                <el-icon class="rotating" v-if="m.thinking"><Loading /></el-icon>
                <el-icon v-else><CircleCheckFilled /></el-icon>
                Agent 执行过程
              </div>
              <div class="steps-list">
                <AgentStepCard v-for="s in m.steps" :key="s.id" :step="s" />
              </div>
            </div>

           <!-- 报告正文 -->
<div v-if="m.content || m.result" class="report-block">
  <div v-if="m.content" class="md report-content" v-html="renderMd(m.content)"></div>

              <!-- 关键指标卡片 -->
              <div v-if="m.result" class="result-cards">
                <div class="result-card">
                  <div class="rc-label">预测订单量</div>
                  <div class="rc-value">{{ formatNumber(m.result.predicted_orders || 0) }}</div>
                  <div class="rc-unit">单</div>
                </div>
                <div class="result-card">
                  <div class="rc-label">预计成本</div>
                  <div class="rc-value">¥{{ formatNumber(m.result.cost_estimate || 0) }}</div>
                </div>
                <div class="result-card">
                  <div class="rc-label">风险等级</div>
                  <div class="rc-value" :class="`risk-${m.result.risk_level}`">
                    {{ m.result.risk_level === 'low' ? '低' : m.result.risk_level === 'medium' ? '中' : '高' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div ref="messagesEnd" />
    </div>

    <!-- 输入区 -->
    <div class="chat-input-area">
      <!-- 推荐问题 -->
      <div v-if="!streaming" class="suggestions">
        <span class="sug-label">💡 推荐：</span>
        <el-button
          v-for="s in suggestions"
          :key="s"
          link
          type="primary"
          @click="sendMessage(s)"
        >
          {{ s }}
        </el-button>
      </div>

      <div ref="inputArea" class="input-wrap">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="2"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="向配送小智提问...（Shift+Enter 换行，Enter 发送）"
          :disabled="streaming"
          @keydown="handleKeydown"
        />
        <el-button
          type="primary"
          size="large"
          class="send-btn"
          :loading="streaming"
          @click="sendMessage()"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
