import Dexie, { type Table } from 'dexie'
import type { Product, Category, Order, OrderItem, Payment, Setting, Member, MemberPointsLog, Promotion, StockRecord, User, Role, LoginLog, OperationLog } from '@/types'

// operators 表保留声明（数据库兼容），已废弃不再使用
interface _Operator { id?: number; name: string; pin: string; isActive: boolean; createdAt: number }

class RetailPosDB extends Dexie {
  products!: Table<Product, number>
  categories!: Table<Category, number>
  orders!: Table<Order, number>
  orderItems!: Table<OrderItem, number>
  payments!: Table<Payment, number>
  operators!: Table<_Operator, number>
  settings!: Table<Setting, string>
  members!: Table<Member, number>
  memberPointsLogs!: Table<MemberPointsLog, number>
  promotions!: Table<Promotion, number>
  stockRecords!: Table<StockRecord, number>
  users!: Table<User, number>
  roles!: Table<Role, number>
  loginLogs!: Table<LoginLog, number>
  operationLogs!: Table<OperationLog, number>

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
    // v3: 用户权限系统
    this.version(3).stores({
      users: '++id, &username, roleCode, isActive, createdAt',
      roles: '++id, &code, sortOrder',
      loginLogs: '++id, userId, username, success, createdAt',
      operationLogs: '++id, userId, action, targetType, createdAt',
    })
  }
}

export const db = new RetailPosDB()

// 密码哈希（简单实现，正式环境请替换为 bcrypt）
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'retailpos_salt_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const h = await hashPassword(password)
  return h === hash
}

// 权限码映射（所有权限）
export const ALL_PERMISSIONS = [
  // 收银
  { code: 'cashier.sale',     name: '收银销售',   category: 'cashier'  as const },
  { code: 'cashier.refund',   name: '订单退款',   category: 'cashier'  as const },
  { code: 'cashier.void',     name: '作废订单',   category: 'cashier'  as const },
  // 商品
  { code: 'product.view',     name: '查看商品',   category: 'product'  as const },
  { code: 'product.create',   name: '新增商品',   category: 'product'  as const },
  { code: 'product.edit',     name: '编辑商品',   category: 'product'  as const },
  { code: 'product.delete',   name: '删除商品',   category: 'product'  as const },
  { code: 'product.import',   name: '导入商品',   category: 'product'  as const },
  { code: 'product.export',   name: '导出商品',   category: 'product'  as const },
  // 订单
  { code: 'order.view',       name: '查看订单',   category: 'order'    as const },
  { code: 'order.refund',     name: '退款订单',   category: 'order'    as const },
  { code: 'order.void',       name: '作废订单',   category: 'order'    as const },
  { code: 'order.import',     name: '导入流水',   category: 'order'    as const },
  // 报表
  { code: 'stats.view',       name: '查看报表',   category: 'stats'    as const },
  { code: 'stats.export',     name: '导出报表',   category: 'stats'    as const },
  // 会员
  { code: 'member.view',      name: '查看会员',   category: 'member'   as const },
  { code: 'member.create',    name: '新增会员',   category: 'member'   as const },
  { code: 'member.edit',      name: '编辑会员',   category: 'member'   as const },
  { code: 'member.delete',    name: '删除会员',   category: 'member'   as const },
  { code: 'member.points',    name: '积分管理',   category: 'member'   as const },
  // 库存
  { code: 'stock.view',       name: '查看库存',   category: 'stock'    as const },
  { code: 'stock.adjust',     name: '调整库存',   category: 'stock'    as const },
  // 促销
  { code: 'promotion.view',   name: '查看促销',   category: 'promotion'as const },
  { code: 'promotion.create', name: '新增促销',   category: 'promotion'as const },
  { code: 'promotion.edit',   name: '编辑促销',   category: 'promotion'as const },
  { code: 'promotion.delete', name: '删除促销',   category: 'promotion'as const },
  // 系统
  { code: 'user.view',        name: '查看用户',   category: 'system'   as const },
  { code: 'user.create',       name: '新增用户',   category: 'system'   as const },
  { code: 'user.edit',         name: '编辑用户',   category: 'system'   as const },
  { code: 'user.delete',       name: '删除用户',   category: 'system'   as const },
  { code: 'user.reset_pwd',    name: '重置密码',   category: 'system'   as const },
  { code: 'user.profile',     name: '修改资料',   category: 'system'   as const },
  { code: 'role.view',         name: '查看角色',   category: 'system'   as const },
  { code: 'role.create',       name: '新增角色',   category: 'system'   as const },
  { code: 'role.edit',         name: '编辑角色',   category: 'system'   as const },
  { code: 'role.delete',       name: '删除角色',   category: 'system'   as const },
  { code: 'oplog.view',        name: '查看日志',   category: 'system'   as const },
  { code: 'oplog.export',      name: '导出日志',   category: 'system'   as const },
  { code: 'settings.manage',   name: '系统设置',   category: 'system'   as const },
  { code: 'backup.manage',     name: '备份还原',   category: 'system'   as const },
]

// 默认角色数据
const DEFAULT_ROLES: Omit<Role, 'id'>[] = [
  {
    code: 'admin',
    name: '系统管理员',
    description: '拥有全部权限，可管理系统所有功能',
    permissions: ALL_PERMISSIONS.map(p => p.code),
    sortOrder: 1,
    canDelete: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    code: 'manager',
    name: '经理',
    description: '管理日常运营，不可管理系统设置',
    permissions: [
      'cashier.sale', 'cashier.refund', 'cashier.void',
      'product.view', 'product.create', 'product.edit',
      'order.view', 'order.refund', 'order.void', 'order.import',
      'stats.view', 'stats.export',
      'member.view', 'member.create', 'member.edit', 'member.points',
      'stock.view', 'stock.adjust',
      'promotion.view', 'promotion.create', 'promotion.edit',
      'settings.manage', 'backup.manage',
    ],
    sortOrder: 2,
    canDelete: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    code: 'cashier',
    name: '收银员',
    description: '负责收银和销售操作',
    permissions: [
      'cashier.sale',
      'product.view',
      'order.view',
      'member.view', 'member.create',
      'stats.view',
    ],
    sortOrder: 3,
    canDelete: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

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

  // 默认角色
  const roleCount = await db.roles.count()
  if (roleCount === 0) {
    await db.roles.bulkAdd(DEFAULT_ROLES)
  }

  // 默认管理员账号
  const userCount = await db.users.count()
  if (userCount === 0) {
    const adminHash = await hashPassword('admin123')
    await db.users.add({
      username: 'admin',
      passwordHash: adminHash,
      realname: '系统管理员',
      roleCode: 'admin',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
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
