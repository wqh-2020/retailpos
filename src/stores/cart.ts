import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, Product, HeldOrder } from '@/types'
import { applyDiscount } from '@/utils/money'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const wholeDiscount = ref(100)  // 整单折扣率，100=无折扣
  const heldOrders = ref<HeldOrder[]>([])

  // 合计（分）
  const subtotal = computed(() =>
    items.value.reduce((s, it) => s + it.subtotal, 0)
  )
  const discountAmount = computed(() =>
    Math.round(subtotal.value * (1 - wholeDiscount.value / 100))
  )
  const total = computed(() => subtotal.value - discountAmount.value)

  function addProduct(product: Product, qty = 1) {
    const existing = items.value.find((it) => it.product.id === product.id)
    if (existing) {
      existing.quantity += qty
      existing.subtotal = applyDiscount(existing.product.price, existing.quantity, existing.discountRate)
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
    const item = items.value.find((it) => it.product.id === productId)
    if (!item) return
    if (qty <= 0) {
      removeItem(productId)
      return
    }
    item.quantity = qty
    item.subtotal = applyDiscount(item.product.price, qty, item.discountRate)
  }

  function updateItemDiscount(productId: number, rate: number) {
    const item = items.value.find((it) => it.product.id === productId)
    if (!item) return
    item.discountRate = rate
    item.subtotal = applyDiscount(item.product.price, item.quantity, rate)
  }

  function removeItem(productId: number) {
    items.value = items.value.filter((it) => it.product.id !== productId)
  }

  function clearCart() {
    items.value = []
    wholeDiscount.value = 100
  }

  function holdOrder() {
    if (items.value.length === 0) return
    heldOrders.value.push({
      id: Date.now().toString(),
      items: JSON.parse(JSON.stringify(items.value)),
      createdAt: Date.now(),
    })
    clearCart()
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

  return {
    items, wholeDiscount, heldOrders,
    subtotal, discountAmount, total,
    addProduct, updateQuantity, updateItemDiscount,
    removeItem, clearCart, holdOrder, resumeOrder, removeHeld,
  }
})
