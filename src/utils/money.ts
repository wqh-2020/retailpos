// 金额工具函数（所有金额以"分"为单位存储）

/** 分 → 元，保留2位小数字符串 */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

/** 元字符串 → 分整数 */
export function yuanToFen(yuan: string | number): number {
  return Math.round(Number(yuan) * 100)
}

/** 格式化为人民币显示 */
export function formatMoney(fen: number): string {
  return `¥${fenToYuan(fen)}`
}

/** 计算折扣后金额（分） */
export function applyDiscount(price: number, qty: number, discountRate: number): number {
  return Math.round((price * qty * discountRate) / 100)
}

// ─── 格式化 ───────────────────────────────────────────────

/** 分 → 元字符串（保留2位） */
export function formatYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

/** 时间戳 → YYYY-MM-DD HH:mm:ss */
export function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 时间戳 → YYYY-MM-DD */
export function formatDateOnly(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
