<script setup lang="ts">
import type { ChatMessage } from '../mock/dashboard';

defineProps<{
  message: ChatMessage;
}>();
</script>

<template>
  <div class="message-row" :class="message.role">
    <div v-if="message.role === 'user'" class="user-bubble">
      {{ message.content }}
    </div>

    <article v-else-if="message.sections" class="ai-card">
      <section>
        <h4>问题理解</h4>
        <p>{{ message.sections.understanding }}</p>
      </section>

      <section>
        <h4>工具调用</h4>
        <div class="tool-tags">
          <span v-for="tool in message.sections.tools" :key="tool">{{ tool }}</span>
        </div>
      </section>

      <section>
        <h4>关键判断</h4>
        <ul class="judgement-list">
          <li v-for="item in message.sections.judgement" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section>
        <h4>运营建议</h4>
        <div class="suggestion-grid">
          <div v-for="(item, index) in message.sections.suggestions" :key="item" class="suggestion-card">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <p>{{ item }}</p>
          </div>
        </div>
      </section>
    </article>
  </div>
</template>
