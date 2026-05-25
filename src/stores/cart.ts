import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, Product, HeldOrder, Member, Promotion, MemberLevel } from '@/types'
import { applyDiscount } from '@/utils/money'
import {
  getPriceLockPromotion,
  getAmountPromotion,
  getBuyGiftPromotion,
} from '@/db/promotions'
import { getLevelLabel } from '@/db/members'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const wholeDiscount = ref(100)  // 整单折扣率，100=无折扣
  const heldOrders = ref<HeldOrder[]>([])

  // ─── 会员相关 ─────────────────────────────────
  const currentMember = ref<Member | null>(null)
  const pointsToRedeem = ref(0)  // 要抵扣的积分数

  // ─── 促销相关 ─────────────────────────────────
  const matchedPromotion = ref<Promotion | null>(null)  // 满减/折扣促销
  const priceLockMap = ref<Record<number, number>>({})   // productId → 锁定价格（分）

  // ─── 积分抵扣比例：10积分 = 1元 = 100分 ─────────────
  const POINTS_RATE = 10  // 1积分 = 10分 = 0.1元

  // ─── 手动结算折扣 ─────────────────────────
  const manualDiscount = ref(0)  // 手动减免金额（分），由结算金额反推

  // ─── Computed ────────────────────────────────
  // 小计（非赠品商品），价格锁定商品用锁定价格
  const subtotal = computed(() =>
    items.value.reduce((s, it) => {
      if (it.isGift) return s
      return s + it.subtotal
    }, 0)
  )

  // 整单折扣减免金额
  const discountAmount = computed(() =>
    Math.round(subtotal.value * (1 - wholeDiscount.value / 100))
  )

  // 积分抵扣金额（分）
  const pointsDeductAmount = computed(() => pointsToRedeem.value * POINTS_RATE)

  // 促销优惠金额（分）
  const promotionDiscount = computed(() => {
    const p = matchedPromotion.value
    if (!p) return 0
    if (p.type === 'amount_off' && p.discountAmount) return p.discountAmount
    return 0  // 折扣类已体现在 wholeDiscount 中
  })

  // 应付合计 = 小计 - 整单折扣 - 促销满减 - 积分抵扣 - 手动减免
  const total = computed(() => {
    const t = subtotal.value - discountAmount.value - promotionDiscount.value - pointsDeductAmount.value - manualDiscount.value
    return Math.max(0, t)
  })

  // ─── 商品操作 ────────────────────────────────
  function addProduct(product: Product, qty = 1) {
    const existing = items.value.find((it) => it.product.id === product.id && !it.isGift)
    if (existing) {
      existing.quantity += qty
      recalcItemSubtotal(existing)
    } else {
      items.value.push({
        product,
        quantity: qty,
        discountRate: 100,
        subtotal: product.price * qty,
      })
    }
  }

  function updateQuantity(productId: number, qty: number) {
    const item = items.value.find((it) => it.product.id === productId && !it.isGift)
    if (!item) return
    if (qty <= 0) {
      removeItem(productId)
      return
    }
    item.quantity = qty
    recalcItemSubtotal(item)
  }

  function updateItemDiscount(productId: number, rate: number) {
    const item = items.value.find((it) => it.product.id === productId && !it.isGift)
    if (!item) return
    item.discountRate = rate
    recalcItemSubtotal(item)
  }

  function removeItem(productId: number) {
    items.value = items.value.filter((it) => it.product.id !== productId || it.isGift)
  }

  // 重新计算单品小计（考虑价格锁定）
  function recalcItemSubtotal(item: CartItem) {
    const lockedPrice = priceLockMap.value[item.product.id!]
    if (lockedPrice !== undefined) {
      item.subtotal = Math.round(lockedPrice * item.quantity * item.discountRate / 100)
    } else {
      item.subtotal = applyDiscount(item.product.price, item.quantity, item.discountRate)
    }
  }

  // ─── 购物车管理 ──────────────────────────────
  function clearCart() {
    items.value = []
    wholeDiscount.value = 100
    matchedPromotion.value = null
    priceLockMap.value = {}
    pointsToRedeem.value = 0
    manualDiscount.value = 0
  }

  function holdOrder() {
    if (items.value.length === 0) return
    heldOrders.value.push({
      id: Date.now().toString(),
      items: JSON.parse(JSON.stringify(items.value)),
      createdAt: Date.now(),
    })
    clearCart()
    // 挂单不解绑会员
  }

  function resumeOrder(id: string) {
    const held = heldOrders.value.find((o) => o.id === id)
    if (!held) return
    items.value = held.items
    heldOrders.value = heldOrders.value.filter((o) => o.id !== id)
  }

  function removeHeld(id: string) {
    heldOrders.value = heldOrders.value.filter((o) => o.id !== id)
  }

  // ─── 会员操作 ────────────────────────────────
  function bindMember(member: Member) {
    currentMember.value = member
    pointsToRedeem.value = 0
    matchPromotions()
  }

  function unbindMember() {
    currentMember.value = null
    pointsToRedeem.value = 0
    // 解绑会员时清除促销匹配
    clearPromotionEffects()
  }

  function setPointsToRedeem(n: number) {
    if (!currentMember.value) return
    const maxPoints = currentMember.value.points
    const maxDeductFen = subtotal.value - discountAmount.value - promotionDiscount.value
    const maxByAmount = maxDeductFen > 0 ? Math.floor(maxDeductFen / POINTS_RATE) : 0
    pointsToRedeem.value = Math.min(n, maxPoints, maxByAmount)
  }

  // 设置结算金额（元），自动反推手动减免金额
  function setSettlementAmount(amountYuan: number) {
    if (!amountYuan || amountYuan <= 0) {
      manualDiscount.value = 0
      return
    }
    const amountFen = Math.round(amountYuan * 100)
    const currentTotal = subtotal.value - discountAmount.value - promotionDiscount.value - pointsDeductAmount.value
    const discount = Math.max(0, currentTotal - amountFen)
    manualDiscount.value = discount
  }

  // 清除手动减免
  function clearManualDiscount() {
    manualDiscount.value = 0
  }

  // ─── 促销匹配 ────────────────────────────────
  async function matchPromotions() {
    clearPromotionEffects()
    const memberLevel = currentMember.value?.level as MemberLevel | undefined
    const normalItems = items.value.filter((it) => !it.isGift)
    if (normalItems.length === 0) return

    // 1. 价格锁定：遍历商品检查
    for (const item of normalItems) {
      const promo = await getPriceLockPromotion(item.product.id!, memberLevel)
      if (promo && promo.lockPrice !== undefined) {
        priceLockMap.value[item.product.id!] = promo.lockPrice
        item.lockedPrice = promo.lockPrice
        item.promotionType = 'price_lock'
        recalcItemSubtotal(item)
      }
    }

    // 2. 满减/折扣：基于当前小计匹配
    const currentSubtotal = items.value.reduce((s, it) => {
      if (it.isGift) return s
      return s + it.subtotal
    }, 0)
    if (currentSubtotal > 0) {
      const amountPromo = await getAmountPromotion(currentSubtotal, memberLevel)
      if (amountPromo) {
        matchedPromotion.value = amountPromo
        if (amountPromo.type === 'percent_off' && amountPromo.discountRate) {
          // 折扣促销：调整整单折扣率（取更低的折扣率）
          wholeDiscount.value = Math.min(wholeDiscount.value, amountPromo.discountRate)
        }
      }
    }

    // 3. 买赠：遍历商品检查
    for (const item of normalItems) {
      const giftPromo = await getBuyGiftPromotion(item.product.id!, item.quantity)
      if (giftPromo) {
        // 添加赠品到购物车
        const giftQty = giftPromo.giftQuantity || 1
        const giftName = giftPromo.giftName || `赠品(${giftPromo.name})`
        // 检查是否已有该赠品
        const existingGift = items.value.find(
          (it) => it.isGift && it.product.id === item.product.id && it.promotionType === 'buy_gift'
        )
        if (existingGift) {
          existingGift.quantity = giftQty
        } else {
          items.value.push({
            product: item.product,
            quantity: giftQty,
            discountRate: 100,
            subtotal: 0,
            isGift: true,
            promotionType: 'buy_gift',
          })
        }
      }
    }
  }

  // 清除促销效果（恢复原价）
  function clearPromotionEffects() {
    matchedPromotion.value = null
    const oldMap = { ...priceLockMap.value }
    priceLockMap.value = {}
    // 恢复被价格锁定的商品
    for (const item of items.value) {
      if (item.lockedPrice !== undefined) {
        item.lockedPrice = undefined
        item.promotionType = undefined
        recalcItemSubtotal(item)
      }
    }
    // 移除赠品
    items.value = items.value.filter((it) => !it.isGift)
    // 如果之前是折扣促销调整的折扣率，恢复为100
    // 注意：不恢复用户手动设置的折扣
  }

  return {
    // state
    items, wholeDiscount, heldOrders,
    currentMember, pointsToRedeem,
    matchedPromotion, priceLockMap,
    manualDiscount,
    // computed
    subtotal, discountAmount, promotionDiscount,
    pointsDeductAmount, total,
    // actions
    addProduct, updateQuantity, updateItemDiscount,
    removeItem, clearCart, holdOrder, resumeOrder, removeHeld,
    bindMember, unbindMember, setPointsToRedeem, matchPromotions,
    recalcItemSubtotal,
    setSettlementAmount, clearManualDiscount,
  }
})
