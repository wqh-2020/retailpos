import Dexie, { type Table } from 'dexie'
import type { Product, Category, Order, OrderItem, Payment, Operator, Setting, Member, MemberPointsLog, Promotion, StockRecord } from '@/types'

class RetailPosDB extends Dexie {
  products!: Table<Product, number>
  categories!: Table<Category, number>
  orders!: Table<Order, number>
  orderItems!: Table<OrderItem, number>
  payments!: Table<Payment, number>
  operators!: Table<Operator, number>
  settings!: Table<Setting, string>
  members!: Table<Member, number>
  memberPointsLogs!: Table<MemberPointsLog, number>
  promotions!: Table<Promotion, number>
  stockRecords!: Table<StockRecord, number>

  constructor() {
    super('retailpos_db')
    this.version(1).stores({
      products: '++id, barcode, name, categoryId, isActive',
      categories: '++id, name, sortOrder',
      orders: '++id, &orderNo, status, createdAt, operatorId',
      orderItems: '++id, orderId, productId',
      payments: '++id, orderId, paymentMethod',
      operators: '++id, name',
      settings: '&key',
    })
    this.version(2).stores({
      products: '++id, barcode, name, categoryId, isActive',
      categories: '++id, name, sortOrder',
      orders: '++id, &orderNo, status, createdAt, operatorId',
      orderItems: '++id, orderId, productId',
      payments: '++id, orderId, paymentMethod',
      operators: '++id, name',
      settings: '&key',
      members: '++id, &phone, name, level, isActive',
      memberPointsLogs: '++id, memberId, type, createdAt',
      promotions: '++id, type, isActive, startDate, endDate',
      stockRecords: '++id, productId, type, createdAt',
    })
  }
}

export const db = new RetailPosDB()

// 初始化默认数据
export async function initDefaultData() {
  // 默认分类
  const catCount = await db.categories.count()
  if (catCount === 0) {
    await db.categories.bulkAdd([
      { name: '食品饮料', sortOrder: 1, createdAt: Date.now() },
      { name: '日用百货', sortOrder: 2, createdAt: Date.now() },
      { name: '烟酒糖茶', sortOrder: 3, createdAt: Date.now() },
      { name: '其他', sortOrder: 99, createdAt: Date.now() },
    ])
  }

  // 默认设置
  const defaults: Record<string, string> = {
    'shop.name': '我的门店',
    'shop.phone': '',
    'shop.address': '',
    'receipt.footer': '谢谢惠顾，欢迎再来！',
    'receipt.showBarcode': 'true',
    'receipt.paperWidth': '80',
    'payment.methods': JSON.stringify([
      { code: 'cash',     label: '现金',    needChange: true,  color: '#67C23A', enabled: true },
      { code: 'wechat',   label: '微信支付', needChange: false, color: '#07C160', enabled: true },
      { code: 'alipay',   label: '支付宝',  needChange: false, color: '#1677FF', enabled: true },
      { code: 'bankcard', label: '银行卡',  needChange: false, color: '#E6A23C', enabled: true },
      { code: 'other',    label: '其他',    needChange: false, color: '#909399', enabled: true },
    ]),
  }

  for (const [key, value] of Object.entries(defaults)) {
    const exists = await db.settings.get(key)
    if (!exists) {
      await db.settings.put({ key, value, updatedAt: Date.now() })
    }
  }
}
