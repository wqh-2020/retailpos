import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '@/stores/cart'
import type { Product } from '@/types'

function mockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? 1,
    barcode: overrides.barcode ?? '6900000000001',
    name: overrides.name ?? '测试商品',
    categoryId: 1,
    price: overrides.price ?? 1000,
    costPrice: overrides.costPrice ?? 500,
    unit: overrides.unit ?? '个',
    stock: overrides.stock ?? 100,
    lowStockThreshold: overrides.lowStockThreshold ?? 10,
    isActive: overrides.isActive ?? true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('cart store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态', () => {
    const cart = useCartStore()
    expect(cart.items).toEqual([])
    expect(cart.wholeDiscount).toBe(100)
    expect(cart.subtotal).toBe(0)
    expect(cart.total).toBe(0)
  })

  it('addProduct 添加商品', () => {
    const cart = useCartStore()
    const product = mockProduct({ id: 1, price: 1000 })
    cart.addProduct(product, 2)

    expect(cart.items.length).toBe(1)
    expect(cart.items[0].product.id).toBe(1)
    expect(cart.items[0].quantity).toBe(2)
    expect(cart.items[0].subtotal).toBe(2000)
  })

  it('addProduct 重复商品叠加数量', () => {
    const cart = useCartStore()
    const product = mockProduct({ id: 1, price: 1000 })
    cart.addProduct(product, 1)
    cart.addProduct(product, 2)

    expect(cart.items.length).toBe(1)
    expect(cart.items[0].quantity).toBe(3)
    expect(cart.items[0].subtotal).toBe(3000)
  })

  it('addProduct 默认数量1', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 500 }))

    expect(cart.items[0].quantity).toBe(1)
    expect(cart.items[0].subtotal).toBe(500)
  })

  it('subtotal 计算合计', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }), 2)
    cart.addProduct(mockProduct({ id: 2, price: 500 }), 3)

    expect(cart.subtotal).toBe(3500)
  })

  it('wholeDiscount 整单折扣', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }), 2) // subtotal 2000
    cart.wholeDiscount = 90 // 9折

    expect(cart.discountAmount).toBe(200)
    expect(cart.total).toBe(1800)
  })

  it('clearCart 清空购物车', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }))
    cart.wholeDiscount = 80
    cart.clearCart()

    expect(cart.items).toEqual([])
    expect(cart.wholeDiscount).toBe(100)
    expect(cart.total).toBe(0)
  })

  it('updateQuantity 更新数量', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }), 1)
    cart.updateQuantity(1, 5)

    expect(cart.items[0].quantity).toBe(5)
    expect(cart.items[0].subtotal).toBe(5000)
  })

  it('updateQuantity 数量为0移除商品', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }))
    cart.updateQuantity(1, 0)

    expect(cart.items.length).toBe(0)
  })

  it('updateQuantity 不存在的商品无操作', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }))
    cart.updateQuantity(999, 5) // 不存在

    expect(cart.items.length).toBe(1)
  })

  it('updateItemDiscount 单品折扣', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }), 2) // subtotal 2000
    cart.updateItemDiscount(1, 80) // 8折

    expect(cart.items[0].discountRate).toBe(80)
    expect(cart.items[0].subtotal).toBe(1600)
  })

  it('removeItem 移除商品', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }))
    cart.addProduct(mockProduct({ id: 2, price: 500 }))
    cart.removeItem(1)

    expect(cart.items.length).toBe(1)
    expect(cart.items[0].product.id).toBe(2)
  })

  it('holdOrder 挂单', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }), 2)
    cart.holdOrder()

    expect(cart.items.length).toBe(0)
    expect(cart.heldOrders.length).toBe(1)
    expect(cart.heldOrders[0].items.length).toBe(1)
  })

  it('holdOrder 空购物车不挂单', () => {
    const cart = useCartStore()
    cart.holdOrder()

    expect(cart.heldOrders.length).toBe(0)
  })

  it('resumeOrder 取单', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }), 2)
    cart.holdOrder()

    const heldId = cart.heldOrders[0].id
    cart.resumeOrder(heldId)

    expect(cart.items.length).toBe(1)
    expect(cart.items[0].quantity).toBe(2)
    expect(cart.heldOrders.length).toBe(0)
  })

  it('resumeOrder 不存在的挂单无操作', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }))
    cart.holdOrder()
    cart.resumeOrder('non-existent-id')

    // 挂单没有被移除
    expect(cart.heldOrders.length).toBe(1)
  })

  it('removeHeld 删除挂单', () => {
    const cart = useCartStore()
    cart.addProduct(mockProduct({ id: 1, price: 1000 }))
    cart.holdOrder()

    const heldId = cart.heldOrders[0].id
    cart.removeHeld(heldId)

    expect(cart.heldOrders.length).toBe(0)
  })
})
