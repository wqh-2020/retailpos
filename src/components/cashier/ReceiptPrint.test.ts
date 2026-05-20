import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import ReceiptPrint from '@/components/cashier/ReceiptPrint.vue'
import type { Order, OrderItem, Payment } from '@/types'

function mockOrder(): Order {
  return {
    id: 1,
    orderNo: '20260520-000001',
    status: 'completed',
    totalAmount: 3500,
    discountAmount: 0,
    actualAmount: 3500,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function mockItems(): OrderItem[] {
  return [
    { id: 1, orderId: 1, productId: 1, productName: '可口可乐', barcode: '6901111111111', price: 300, quantity: 10, discountRate: 100, subtotal: 3000 },
    { id: 2, orderId: 1, productId: 2, productName: '农夫山泉', barcode: '6902222222222', price: 200, quantity: 5, discountRate: 100, subtotal: 1000 },
  ]
}

function mockPayments(): Payment[] {
  return [
    { id: 1, orderId: 1, paymentMethod: 'cash', amount: 4000, changeAmount: 500, createdAt: Date.now() },
  ]
}

function mountReceipt(items = mockItems()) {
  return mount(ReceiptPrint, {
    props: {
      order: mockOrder(),
      items,
      payments: mockPayments(),
    },
    global: {
      plugins: [createPinia(), ElementPlus],
      stubs: {
        'el-dialog': { template: '<div class="el-dialog"><slot /><slot name="footer" /></div>' },
        'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: true },
        'el-icon': true,
      },
    },
  })
}

describe('ReceiptPrint.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('渲染小票基本结构', () => {
    const wrapper = mountReceipt()
    expect(wrapper.find('.receipt').exists()).toBe(true)
    expect(wrapper.find('.receipt-header').exists()).toBe(true)
  })

  it('显示订单号', () => {
    const wrapper = mountReceipt()
    const text = wrapper.text()
    expect(text).toContain('20260520-000001')
  })

  it('显示商品明细', () => {
    const wrapper = mountReceipt()
    expect(wrapper.find('.items-table').exists()).toBe(true)
    expect(wrapper.text()).toContain('可口可乐')
    expect(wrapper.text()).toContain('农夫山泉')
  })

  it('显示合计金额', () => {
    const wrapper = mountReceipt()
    expect(wrapper.text()).toContain('35.00')
  })

  it('显示支付方式', () => {
    const wrapper = mountReceipt()
    expect(wrapper.find('.pay-section').exists()).toBe(true)
  })

  it('显示页脚', () => {
    const wrapper = mountReceipt()
    expect(wrapper.find('.receipt-footer').exists()).toBe(true)
  })

  it('折扣标记正确显示', () => {
    const items: OrderItem[] = [
      { id: 1, orderId: 1, productId: 1, productName: '打折商品', barcode: '1', price: 1000, quantity: 2, discountRate: 80, subtotal: 1600 },
    ]
    const wrapper = mountReceipt(items)
    expect(wrapper.find('.discount-badge').exists()).toBe(true)
    expect(wrapper.find('.discount-badge').text()).toContain('80折')
  })
})
