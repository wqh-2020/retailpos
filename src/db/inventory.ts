import { db } from './index'
import type { StockRecord, StockOpType } from '@/types'

// ─── 库存查询 ─────────────────────────────────────────────

export async function getStockList(opts?: {
  categoryId?: number
  keyword?: string
  lowStockOnly?: boolean
  page?: number
  pageSize?: number
}): Promise<{ list: (StockProduct & { stock: number })[]; total: number }> {
  const all = await db.products.filter((p) => p.isActive).toArray()

  let filtered = all.map((p) => ({
    id: p.id!,
    barcode: p.barcode,
    name: p.name,
    categoryId: p.categoryId,
    unit: p.unit,
    price: p.price,
    stock: (p as any).stock ?? 0,
    lowStockThreshold: (p as any).lowStockThreshold ?? 10,
  }))

  if (opts?.categoryId) {
    filtered = filtered.filter((p) => p.categoryId === opts.categoryId)
  }
  if (opts?.keyword) {
    const kw = opts.keyword.toLowerCase()
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(kw) || p.barcode.includes(kw))
  }
  if (opts?.lowStockOnly) {
    filtered = filtered.filter((p) => p.stock <= p.lowStockThreshold)
  }

  const total = filtered.length
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20
  const list = filtered.slice((page - 1) * pageSize, page * pageSize)

  return { list, total }
}

export interface StockProduct {
  id: number
  barcode: string
  name: string
  categoryId: number
  unit: string
  price: number
  stock: number
  lowStockThreshold: number
}

export async function getProductStock(productId: number): Promise<number> {
  const records = await db.stockRecords.where('productId').equals(productId).toArray()
  return records.reduce((s, r) => s + r.quantity, 0)
}

export async function syncProductStock(productId: number): Promise<void> {
  const stock = await getProductStock(productId)
  await db.products.update(productId, { stock, updatedAt: Date.now() })
}

// ─── 库存记录 ─────────────────────────────────────────────

export async function addStockRecord(
  productId: number,
  type: StockOpType,
  quantity: number,
  remark?: string,
  operatorId?: number,
  orderId?: number
): Promise<void> {
  const stockBefore = await getProductStock(productId)
  const product = await db.products.get(productId)
  if (!product) throw new Error('商品不存在')

  const stockAfter = stockBefore + quantity
  if (stockAfter < 0) throw new Error('库存不足')

  await db.transaction('rw', [db.stockRecords, db.products], async () => {
    await db.stockRecords.add({
      productId,
      productName: product.name,
      barcode: product.barcode,
      type,
      quantity,
      stockBefore,
      stockAfter,
      orderId,
      remark,
      operatorId,
      createdAt: Date.now(),
    })
    await syncProductStock(productId)
  })
}

export async function getStockRecords(opts?: {
  productId?: number
  type?: StockOpType
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}): Promise<{ list: StockRecord[]; total: number }> {
  const startTs = opts?.startDate ? new Date(opts.startDate + ' 00:00:00').getTime() : 0
  const endTs = opts?.endDate ? new Date(opts.endDate + ' 23:59:59').getTime() : Date.now()

  let collection = db.stockRecords.filter((r) => {
    if (r.createdAt < startTs || r.createdAt > endTs) return false
    if (opts?.productId && r.productId !== opts.productId) return false
    if (opts?.type && r.type !== opts.type) return false
    return true
  })

  const total = await collection.count()
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20
  const list = await collection
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .reverse()
    .sortBy('createdAt')

  return { list, total }
}

export async function getLowStockProducts(): Promise<StockProduct[]> {
  const { list } = await getStockList({ lowStockOnly: true })
  return list
}

export async function updateProductStockSetting(productId: number, stock: number, threshold: number): Promise<void> {
  await db.products.update(productId, { stock, lowStockThreshold: threshold, updatedAt: Date.now() })
}
