import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// 输出经过XSS消毒的安全HTML
export function renderSafeMarkdown(rawMarkdown: string) {
  const rawHtml = md.render(rawMarkdown)
  const safeHtml = DOMPurify.sanitize(rawHtml)
  return safeHtml
}
