/** 生成订单号：YYYYMMDD-XXXXXX（6位随机数） */
export function generateOrderNo(): string {
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  return `${date}-${rand}`
}

/** 格式化时间戳为本地时间字符串 */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/** 格式化日期（仅日期部分） */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

/** 获取今日起始时间戳（毫秒） */
export function todayStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 获取今日结束时间戳（毫秒） */
export function todayEnd(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}
