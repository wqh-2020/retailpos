import { db } from './index'

// ─── 商品销售 Top N ───────────────────────────────────────
export interface ProductStat {
  productId: number
  productName: string
  barcode: string
  totalQty: number
  totalAmount: number // 分
}

export async function getTopProducts(
  startTs: number,
  endTs: number,
  limit = 10
): Promise<ProductStat[]> {
  const orderIds = (await db.orders
    .where('createdAt')
    .between(startTs, endTs)
    .filter((o) => o.status === 'completed')
    .primaryKeys()) as number[]

  if (!orderIds.length) return []

  const items = await db.orderItems
    .filter((it) => orderIds.includes(it.orderId))
    .toArray()

  const map = new Map<number, ProductStat>()
  for (const it of items) {
    const existing = map.get(it.productId)
    if (existing) {
      existing.totalQty += it.quantity
      existing.totalAmount += it.subtotal
    } else {
      map.set(it.productId, {
        productId: it.productId,
        productName: it.productName,
        barcode: it.barcode,
        totalQty: it.quantity,
        totalAmount: it.subtotal,
      })
    }
  }

  return [...map.values()]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit)
}

// ─── 分类销售统计 ────────────────────────────────────────
export interface CategoryStat {
  categoryId: number
  categoryName: string
  totalAmount: number
  totalQty: number
}

export async function getCategoryStats(
  startTs: number,
  endTs: number
): Promise<CategoryStat[]> {
  const orderIds = (await db.orders
    .where('createdAt')
    .between(startTs, endTs)
    .filter((o) => o.status === 'completed')
    .primaryKeys()) as number[]

  if (!orderIds.length) return []

  const items = await db.orderItems
    .filter((it) => orderIds.includes(it.orderId))
    .toArray()

  // 批量获取商品信息（productId -> categoryId）
  const productIds = [...new Set(items.map((it) => it.productId))]
  const products = await db.products.where('id').anyOf(productIds).toArray()
  const prodMap = new Map(products.map((p) => [p.id!, p]))

  // 获取所有分类
  const categories = await db.categories.toArray()
  const catMap = new Map(categories.map((c) => [c.id!, c.name]))

  const statMap = new Map<number, CategoryStat>()
  for (const it of items) {
    const prod = prodMap.get(it.productId)
    const catId = prod?.categoryId ?? 0
    const catName = catMap.get(catId) ?? '未分类'
    const existing = statMap.get(catId)
    if (existing) {
      existing.totalAmount += it.subtotal
      existing.totalQty += it.quantity
    } else {
      statMap.set(catId, { categoryId: catId, categoryName: catName, totalAmount: it.subtotal, totalQty: it.quantity })
    }
  }

  return [...statMap.values()].sort((a, b) => b.totalAmount - a.totalAmount)
}

// ─── 每日销售趋势 ────────────────────────────────────────
export interface DayStat {
  date: string    // YYYY-MM-DD
  amount: number  // 分
  count: number
}

export async function getDailyTrend(
  startTs: number,
  days: number
): Promise<DayStat[]> {
  const endTs = startTs + days * 86400000

  const orders = await db.orders
    .where('createdAt')
    .between(startTs, endTs)
    .filter((o) => o.status === 'completed')
    .toArray()

  // 初始化每天的数据
  const result: DayStat[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(startTs + i * 86400000)
    result.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      amount: 0,
      count: 0,
    })
  }

  for (const o of orders) {
    const d = new Date(o.createdAt)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const idx = result.findIndex((r) => r.date === dateStr)
    if (idx >= 0) {
      result[idx].amount += o.actualAmount
      result[idx].count += 1
    }
  }

  return result
}
