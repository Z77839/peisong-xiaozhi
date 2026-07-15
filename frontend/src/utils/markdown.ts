/**
 * Markdown 渲染工具
 * marked v9 兼容 Node 14 / ESM
 */
import { marked } from 'marked'

// 配置
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
})

/**
 * 把 markdown 字符串渲染成 HTML 字符串
 */
export function renderMarkdown(src: string): string {
  if (!src) return ''
  try {
    return marked(src) as string
  } catch (e) {
    return `<pre>${escapeHtml(src)}</pre>`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  })
}
