// 全局类型定义

export interface Product {
  id?: number
  barcode: string
  name: string
  categoryId: number
  price: number        // 存储单位：分
  costPrice?: number   // 存储单位：分
  unit: string
  remark?: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface Category {
  id?: number
  name: string
  sortOrder: number
  createdAt: number
}

export interface Order {
  id?: number
  orderNo: string
  status: 'completed' | 'refunded' | 'voided'
  totalAmount: number   // 分
  discountAmount: number // 分
  actualAmount: number  // 分
  operatorId?: number
  remark?: string
  createdAt: number
  updatedAt: number
}

export interface OrderItem {
  id?: number
  orderId: number
  productId: number
  productName: string
  barcode: string
  price: number        // 分
  quantity: number
  discountRate: number // 0-100，100=无折扣
  subtotal: number     // 分
}

export interface Payment {
  id?: number
  orderId: number
  paymentMethod: PaymentMethodCode
  amount: number       // 分
  changeAmount: number // 找零，分
  remark?: string
  createdAt: number
}

export interface Operator {
  id?: number
  name: string
  pin: string          // SHA-256 哈希
  isActive: boolean
  createdAt: number
}

export interface Setting {
  key: string
  value: string
  updatedAt: number
}

export type PaymentMethodCode = 'cash' | 'wechat' | 'alipay' | 'bankcard' | 'other'

export interface PaymentMethod {
  code: PaymentMethodCode
  label: string
  needChange: boolean
  color: string
  enabled: boolean
}

export interface CartItem {
  product: Product
  quantity: number
  discountRate: number  // 0-100
  subtotal: number      // 分
}

export interface HeldOrder {
  id: string
  items: CartItem[]
  createdAt: number
}

// 分页参数
export interface PageQuery {
  page: number
  pageSize: number
}

// 订单查询参数
export interface OrderQuery extends PageQuery {
  startDate?: string
  endDate?: string
  paymentMethod?: PaymentMethodCode | ''
  status?: Order['status'] | ''
  keyword?: string
}
