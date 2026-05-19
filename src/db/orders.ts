import { db } from './index'
import type { Order, OrderItem, Payment, OrderQuery } from '@/types'

// ─── 写入订单（事务） ────────────────────────────────────

export async function createOrder(
  order: Omit<Order, 'id'>,
  items: Omit<OrderItem, 'id' | 'orderId'>[],
  payments: Omit<Payment, 'id' | 'orderId'>[]
): Promise<number> {
  return db.transaction('rw', [db.orders, db.orderItems, db.payments], async () => {
    const orderId = await db.orders.add(order)
    await db.orderItems.bulkAdd(items.map((it) => ({ ...it, orderId })))
    await db.payments.bulkAdd(payments.map((p) => ({ ...p, orderId })))
    return orderId
  })
}

// ─── 查询订单 ────────────────────────────────────────────

export async function queryOrders(q: OrderQuery): Promise<{ list: Order[]; total: number }> {
  const startTs = q.startDate ? new Date(q.startDate + ' 00:00:00').getTime() : 0
  const endTs = q.endDate ? new Date(q.endDate + ' 23:59:59').getTime() : Date.now() + 86400000

  let collection = db.orders.filter((o) => {
    if (o.createdAt < startTs || o.createdAt > endTs) return false
    if (q.status && o.status !== q.status) return false
    if (q.keyword && !o.orderNo.includes(q.keyword)) return false
    return true
  })

  // 如果按支付方式过滤，需要子查询
  let list = await collection.reverse().sortBy('createdAt')

  if (q.paymentMethod) {
    const orderIds = await db.payments
      .where('paymentMethod')
      .equals(q.paymentMethod)
      .uniqueKeys()
    const idSet = new Set(orderIds as number[])
    list = list.filter((o) => idSet.has(o.id!))
  }

  const total = list.length
  const page = q.page ?? 1
  const pageSize = q.pageSize ?? 20
  const paged = list.slice((page - 1) * pageSize, page * pageSize)

  return { list: paged, total }
}

export async function getOrderById(id: number): Promise<Order | undefined> {
  return db.orders.get(id)
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  return db.orderItems.where('orderId').equals(orderId).toArray()
}

export async function getOrderPayments(orderId: number): Promise<Payment[]> {
  return db.payments.where('orderId').equals(orderId).toArray()
}

// ─── 退款 ────────────────────────────────────────────────

export async function refundOrder(orderId: number): Promise<void> {
  const order = await db.orders.get(orderId)
  if (!order || order.status !== 'completed') throw new Error('订单状态不允许退款')

  await db.transaction('rw', [db.orders, db.payments], async () => {
    await db.orders.update(orderId, { status: 'refunded', updatedAt: Date.now() })
    // 写入退款流水（负金额）
    const origPayments = await db.payments.where('orderId').equals(orderId).toArray()
    await db.payments.bulkAdd(
      origPayments.map((p) => ({
        orderId,
        paymentMethod: p.paymentMethod,
        amount: -p.amount,
        changeAmount: 0,
        remark: '退款',
        createdAt: Date.now(),
      }))
    )
  })
}

// ─── 作废 ────────────────────────────────────────────────

export async function voidOrder(orderId: number): Promise<void> {
  const order = await db.orders.get(orderId)
  if (!order || order.status !== 'completed') throw new Error('订单状态不允许作废')
  await db.orders.update(orderId, { status: 'voided', updatedAt: Date.now() })
}

// ─── 报表统计 ────────────────────────────────────────────

export async function getSalesStats(startTs: number, endTs: number) {
  const orders = await db.orders
    .where('createdAt')
    .between(startTs, endTs)
    .filter((o) => o.status === 'completed')
    .toArray()

  const total = orders.reduce((s, o) => s + o.actualAmount, 0)
  const count = orders.length
  const avgAmount = count > 0 ? Math.round(total / count) : 0

  return { total, count, avgAmount }
}

export async function getPaymentStats(startTs: number, endTs: number) {
  const orderIds = await db.orders
    .where('createdAt')
    .between(startTs, endTs)
    .filter((o) => o.status === 'completed')
    .primaryKeys()

  const payments = await db.payments
    .filter((p) => (orderIds as number[]).includes(p.orderId) && p.amount > 0)
    .toArray()

  const stats: Record<string, { amount: number; count: number }> = {}
  for (const p of payments) {
    if (!stats[p.paymentMethod]) stats[p.paymentMethod] = { amount: 0, count: 0 }
    stats[p.paymentMethod].amount += p.amount
    stats[p.paymentMethod].count += 1
  }
  return stats
}
