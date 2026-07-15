/**
 * Markdown 渲染工具
 * 兼容 marked v5-v12 所有版本
 */
import * as markedLib from 'marked'

// 兼容不同版本的 marked 导出
const markedFn: any =
  (markedLib as any).marked?.parse
    ? (text: string) => (markedLib as any).marked.parse(text)
    : (markedLib as any).parse
      ? (text: string) => (markedLib as any).parse(text)
      : (markedLib as any).default?.parse
        ? (text: string) => (markedLib as any).default.parse(text)
        : (markedLib as any).default || markedLib

// 配置 GFM（GitHub Flavored Markdown）
try {
  const target = (markedLib as any).marked || (markedLib as any).default || markedLib
  if (target?.setOptions) {
    target.setOptions({ gfm: true, breaks: true, pedantic: false })
  }
} catch (e) {
  // 静默
}

/**
 * 把 markdown 字符串渲染成 HTML 字符串
 */
export function renderMarkdown(src: string): string {
  if (!src) return ''
  try {
    const html = markedFn(src)
    return typeof html === 'string' ? html : String(html || '')
  } catch (e) {
    return `<pre>${escapeHtml(src)}</pre>`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
