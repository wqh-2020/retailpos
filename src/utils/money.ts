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
