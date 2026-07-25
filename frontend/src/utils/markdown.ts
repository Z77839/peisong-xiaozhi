import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

export function renderSafeMarkdown(rawMarkdown: string) {
  const rawHtml = md.render(rawMarkdown)
  const safeHtml = DOMPurify.sanitize(rawHtml)
  return safeHtml
}
