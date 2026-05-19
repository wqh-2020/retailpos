import { db } from './index'
import type { Promotion, MemberLevel } from '@/types'

/** 获取当前生效的促销活动 */
export async function getActivePromotions(memberLevel?: MemberLevel): Promise<Promotion[]> {
  const now = Date.now()
  let list = await db.promotions
    .filter((p) => p.isActive && p.startDate <= now && p.endDate >= now)
    .toArray()

  if (memberLevel) {
    list = list.filter(
      (p) => !p.applicableLevels || p.applicableLevels.length === 0 || p.applicableLevels.includes(memberLevel)
    )
  }
  return list
}

/** 按商品找适用的价格锁定促销 */
export async function getPriceLockPromotion(productId: number, memberLevel?: MemberLevel): Promise<Promotion | undefined> {
  const promotions = await getActivePromotions(memberLevel)
  return promotions.find(
    (p) => p.type === 'price_lock' && p.lockProductId === productId
  )
}

/** 按订单金额找满减/折扣促销 */
export async function getAmountPromotion(orderAmountFen: number, memberLevel?: MemberLevel): Promise<Promotion | undefined> {
  const promotions = await getActivePromotions(memberLevel)
  // 优先找门槛最接近的
  const eligible = promotions
    .filter((p) => (p.type === 'amount_off' || p.type === 'percent_off') && p.thresholdAmount && orderAmountFen >= p.thresholdAmount)
    .sort((a, b) => (a.thresholdAmount ?? 0) - (b.thresholdAmount ?? 0))
  return eligible[eligible.length - 1]
}

/** 买赠促销（检查是否含指定商品） */
export async function getBuyGiftPromotion(buyProductId: number, buyQuantity: number): Promise<Promotion | undefined> {
  const promotions = await getActivePromotions()
  return promotions.find(
    (p) => p.type === 'buy_gift' && p.buyProductId === buyProductId && (!p.buyQuantity || buyQuantity >= p.buyQuantity)
  )
}

export async function getPromotions(opts?: {
  keyword?: string
  type?: Promotion['type']
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<{ list: Promotion[]; total: number }> {
  let collection = db.promotions.filter((p) => {
    if (opts?.isActive !== undefined && p.isActive !== opts.isActive) return false
    if (opts?.type && p.type !== opts.type) return false
    if (opts?.keyword) {
      return p.name.toLowerCase().includes(opts.keyword.toLowerCase())
    }
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

export async function addPromotion(data: Omit<Promotion, 'id'>): Promise<number> {
  return db.promotions.add(data)
}

export async function updatePromotion(id: number, data: Partial<Promotion>): Promise<void> {
  await db.promotions.update(id, { ...data, updatedAt: Date.now() })
}

export async function deletePromotion(id: number): Promise<void> {
  await db.promotions.delete(id)
}

export async function togglePromotion(id: number): Promise<void> {
  const p = await db.promotions.get(id)
  if (p) await db.promotions.update(id, { isActive: !p.isActive, updatedAt: Date.now() })
}
