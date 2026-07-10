<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { ChatMessage } from '../mock/dashboard';
import MessageCard from './MessageCard.vue';

const props = defineProps<{
  messages: ChatMessage[];
  quickQuestions: string[];
  loading: boolean;
}>();

const emit = defineEmits<{
  send: [question: string];
}>();

const inputValue = ref('');
const scroller = ref<HTMLDivElement | null>(null);

function sendQuestion(question = inputValue.value) {
  const trimmed = question.trim();
  if (!trimmed || props.loading) return;
  emit('send', trimmed);
  inputValue.value = '';
}

watch(
  () => [props.messages.length, props.loading],
  async () => {
    await nextTick();
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' });
  },
);
</script>

<template>
  <section class="chat-panel">
    <div ref="scroller" class="chat-scroll">
      <div v-if="messages.length === 0" class="welcome-state">
        <span class="welcome-orb">AI</span>
        <h1>开启新的配送运营分析</h1>
        <p>选择一个高频问题，或直接输入你想分析的城市配送运营场景。</p>
        <div class="quick-grid">
          <button
            v-for="question in quickQuestions"
            :key="question"
            type="button"
            @click="sendQuestion(question)"
          >
            {{ question }}
          </button>
        </div>
      </div>

      <template v-else>
        <MessageCard v-for="message in messages" :key="message.id" :message="message" />
        <div v-if="loading" class="message-row assistant">
          <div class="typing-card">
            <span></span>
            <span></span>
            <span></span>
            正在调用运营工具...
          </div>
        </div>
      </template>
    </div>

    <div class="composer">
      <button class="icon-button add" type="button" title="添加数据文件">+</button>
      <input
        v-model="inputValue"
        type="text"
        placeholder="输入配送运营问题，例如：浦东晚高峰如何调度？"
        @keydown.enter="sendQuestion()"
      />
      <select aria-label="高级模式">
        <option>高级模式</option>
        <option>快速模式</option>
        <option>成本优先</option>
        <option>履约优先</option>
      </select>
      <button class="icon-button" type="button" title="语音输入">◉</button>
      <button class="send-button" type="button" :disabled="loading" @click="sendQuestion()">发送</button>
    </div>
  </section>
</template>
