import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import PayDialog from '@/components/cashier/PayDialog.vue'
import type { CartItem, Product } from '@/types'

function mockProduct(id: number, price: number): Product {
  return {
    id, barcode: `69000000000${id}`, name: `商品${id}`,
    categoryId: 1, price, costPrice: Math.round(price * 0.5),
    unit: '个', stock: 100, lowStockThreshold: 10,
    isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
  }
}

function mockCartItem(id: number, price: number, qty: number): CartItem {
  return {
    product: mockProduct(id, price),
    quantity: qty,
    discountRate: 100,
    subtotal: price * qty,
  }
}

function mountPayDialog(props: { total: number; cartItems: CartItem[]; discountAmount?: number; member?: any; pointsToRedeem?: number; matchedPromotion?: any }) {
  return mount(PayDialog, {
    props: {
      modelValue: true,
      total: props.total,
      cartItems: props.cartItems,
      discountAmount: props.discountAmount ?? 0,
      member: props.member ?? null,
      pointsToRedeem: props.pointsToRedeem ?? 0,
      matchedPromotion: props.matchedPromotion ?? null,
    },
    global: {
      plugins: [createPinia(), ElementPlus],
      stubs: {
        'el-dialog': { template: '<div class="el-dialog"><slot /><slot name="footer" /></div>' },
        'el-input-number': {
          props: ['modelValue', 'precision', 'min', 'step'],
          template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
          inheritAttrs: false,
        },
        'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: true },
      },
    },
  })
}

describe('PayDialog.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('渲染应收金额', () => {
    const wrapper = mountPayDialog({
      total: 3500, // ¥35
      cartItems: [mockCartItem(1, 1000, 2), mockCartItem(2, 1500, 1)],
    })
    expect(wrapper.find('.pay-total-amount').text()).toContain('35')
  })

  it('显示确认收款和取消按钮', () => {
    const wrapper = mountPayDialog({
      total: 1000,
      cartItems: [mockCartItem(1, 1000, 1)],
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.some(b => b.text().includes('确认收款'))).toBe(true)
    expect(buttons.some(b => b.text().includes('取消'))).toBe(true)
  })

  it('渲染支付方式选择区', () => {
    const wrapper = mountPayDialog({
      total: 1000,
      cartItems: [mockCartItem(1, 1000, 1)],
    })
    expect(wrapper.find('.pay-methods').exists()).toBe(true)
  })
})
