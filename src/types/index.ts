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
  // 库存相关（M8）
  stock?: number             // 当前库存（由 stockRecords 汇总，或直接存储）
  lowStockThreshold?: number // 库存预警阈值
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

// ─── 会员 ───────────────────────────────────────────────

export type MemberLevel = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface Member {
  id?: number
  phone: string        // 手机号（唯一，作为登录/查询凭证）
  name: string
  level: MemberLevel
  points: number        // 当前积分
  totalPoints: number  // 累计积分
  discountRate: number // 折扣率 0-100，100=不打折
  birthday?: string    // 格式 YYYY-MM-DD
  remark?: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface MemberPointsLog {
  id?: number
  memberId: number
  type: 'earn' | 'redeem' | 'adjust' | 'expire'
  points: number       // 正数=获得，负数=消耗
  orderId?: number     // 关联订单（获得积分时）
  orderNo?: string     // 关联订单号（展示用）
  remark?: string
  createdAt: number
}

// ─── 促销 ───────────────────────────────────────────────

export type PromotionType = 'amount_off' | 'percent_off' | 'buy_gift' | 'price_lock'

export interface Promotion {
  id?: number
  name: string
  type: PromotionType
  // 满减/折扣: 满足条件
  thresholdAmount?: number   // 满 N 元（分）
  discountAmount?: number    // 减 N 元（分）
  discountRate?: number      // 打 N% 折（0-100）
  // 买赠: 买指定商品/数量
  buyProductId?: number
  buyQuantity?: number
  giftProductId?: number
  giftQuantity?: number
  giftName?: string
  // 价格锁定: 指定商品享受优惠价
  lockProductId?: number
  lockPrice?: number         // 分
  // 通用
  startDate: number          // 毫秒时间戳
  endDate: number            // 毫秒时间戳
  applicableLevels?: MemberLevel[] // 适用会员等级，空=所有
  isActive: boolean
  createdAt: number
  updatedAt: number
}

// ─── 库存 ───────────────────────────────────────────────

export type StockOpType = 'purchase' | 'adjust_add' | 'adjust_minus' | 'sale' | 'return' | 'void'

export interface StockRecord {
  id?: number
  productId: number
  productName: string
  barcode: string
  type: StockOpType
  quantity: number       // 正数=入库/退回，负数=出库
  stockBefore: number    // 操作前库存
  stockAfter: number      // 操作后库存
  orderId?: number       // 关联订单
  remark?: string
  operatorId?: number
  createdAt: number
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
