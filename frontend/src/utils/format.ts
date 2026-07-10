import dayjs from 'dayjs'

export function formatNumber(n: number | string, decimals = 0): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '--'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: decimals })
}

export function formatPercent(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + '%'
}

export function formatTime(t: string | number | Date, fmt = 'YYYY-MM-DD HH:mm'): string {
  return dayjs(t).format(fmt)
}

export function relativeTime(t: string | number | Date): string {
  const diff = Date.now() - new Date(t).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  return formatTime(t, 'MM-DD HH:mm')
}
