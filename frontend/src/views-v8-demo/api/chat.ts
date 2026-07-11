import { mockChatReply, type ChatMessage } from '../mock/dashboard';
import { API_BASE_URL } from '@/utils/apiBase';

export async function sendChatMessage(message: string): Promise<ChatMessage> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('chat request failed');
    return await res.json();
  } catch (error) {
    console.warn('使用 mock chat 数据', error);
    return mockChatReply(message);
  }
}
