import { describe, it, expect, beforeEach } from 'vitest'
import { db, initDefaultData, hashPassword, verifyPassword } from '@/db'
import * as products from '@/db/products'
import * as orders from '@/db/orders'
import * as members from '@/db/members'
import * as promotions from '@/db/promotions'
import * as inventory from '@/db/inventory'
import * as reports from '@/db/reports'
import * as auth from '@/db/auth'
import type { Product, Order, OrderItem, Payment, Member, Promotion, MemberLevel } from '@/types'

describe('DB Layer', () => {
  beforeEach(async () => {
    // 每次测试前清空所有表
    const tableNames = db.tables.map(t => t.name)
    await Promise.all(tableNames.map(name => db.table(name).clear()))
    await initDefaultData()
  })

  // ─── 密码哈希 ────────────────────────────────────────────
  describe('hashPassword / verifyPassword', () => {
    it('哈希长度 64 字符', async () => {
      const hash = await hashPassword('admin123')
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('相同密码相同哈希', async () => {
      const h1 = await hashPassword('test')
      const h2 = await hashPassword('test')
      expect(h1).toBe(h2)
    })

    it('不同密码不同哈希', async () => {
      const h1 = await hashPassword('pass1')
      const h2 = await hashPassword('pass2')
      expect(h1).not.toBe(h2)
    })

    it('验证正确密码', async () => {
      const hash = await hashPassword('mypassword')
      expect(await verifyPassword('mypassword', hash)).toBe(true)
    })

    it('验证错误密码', async () => {
      const hash = await hashPassword('mypassword')
      expect(await verifyPassword('wrongpassword', hash)).toBe(false)
    })
  })

  // ─── initDefaultData ─────────────────────────────────────
  describe('initDefaultData', () => {
    it('初始化默认分类', async () => {
      const cats = await db.categories.count()
      expect(cats).toBe(4)
    })

    it('初始化默认角色', async () => {
      const roles = await db.roles.count()
      expect(roles).toBe(3)
    })

    it('初始化管理员账号', async () => {
      const admin = await db.users.where('username').equals('admin').first()
      expect(admin).toBeDefined()
      expect(admin!.roleCode).toBe('admin')
    })

    it('管理员密码可验证', async () => {
      const admin = await db.users.where('username').equals('admin').first()
      expect(await verifyPassword('admin123', admin!.passwordHash)).toBe(true)
    })

    it('重复初始化不重复数据', async () => {
      await initDefaultData()
      const cats = await db.categories.count()
      expect(cats).toBe(4) // 不变成 8
    })
  })

  // ─── 商品管理 ────────────────────────────────────────────
  describe('products', () => {
    async function seedProduct(overrides: Partial<Product> = {}): Promise<number> {
      const catId = (await db.categories.toCollection().first())!.id!
      return db.products.add({
        barcode: overrides.barcode || '6901234567890',
        name: overrides.name || '测试商品',
        categoryId: catId,
        price: overrides.price ?? 1000,
        costPrice: overrides.costPrice ?? 500,
        unit: overrides.unit || '个',
        stock: overrides.stock ?? 100,
        lowStockThreshold: overrides.lowStockThreshold ?? 10,
        isActive: overrides.isActive ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    it('getCategories 返回分类列表', async () => {
      const cats = await products.getCategories()
      expect(cats.length).toBe(4)
      expect(cats[0].name).toBe('食品饮料') // sortOrder 1
    })

    it('addCategory / updateCategory / deleteCategory', async () => {
      const id = await products.addCategory({ name: '新分类', sortOrder: 10, createdAt: Date.now() })
      const cats = await products.getCategories()
      expect(cats.find(c => c.name === '新分类')).toBeTruthy()

      await products.updateCategory(id, { name: '修改分类' })
      const updated = await db.categories.get(id)
      expect(updated!.name).toBe('修改分类')

      await products.deleteCategory(id)
      expect(await db.categories.get(id)).toBeUndefined()
    })

    it('getProducts 分页查询', async () => {
      for (let i = 0; i < 25; i++) {
        await seedProduct({ name: `商品${i}` })
      }
      const result = await products.getProducts({ page: 1, pageSize: 10 })
      expect(result.list.length).toBe(10)
      expect(result.total).toBe(25)
    })

    it('getProducts 关键词搜索', async () => {
      await seedProduct({ name: '可口可乐', barcode: '6901111111111' })
      await seedProduct({ name: '百事可乐', barcode: '6902222222222' })

      const result = await products.getProducts({ keyword: '可乐' })
      expect(result.total).toBe(2)
    })

    it('getProducts 条码搜索', async () => {
      await seedProduct({ name: '商品A', barcode: '6909999999999' })
      const result = await products.getProducts({ keyword: '690999' })
      expect(result.total).toBe(1)
    })

    it('getProducts 分类过滤', async () => {
      const catId = (await db.categories.toCollection().first())!.id!
      await seedProduct({ name: '商品A', categoryId: catId })
      await seedProduct({ name: '商品B', categoryId: catId })

      const result = await products.getProducts({ categoryId: catId })
      expect(result.total).toBeGreaterThanOrEqual(2)
    })

    it('searchProducts 仅搜索活跃商品', async () => {
      const id = await seedProduct({ name: '活跃商品' })
      const inactiveId = await seedProduct({ name: '下架商品', isActive: false })

      const result = await products.searchProducts('商品')
      expect(result.length).toBe(1)
      expect(result[0].name).toBe('活跃商品')
    })

    it('deleteProduct 软删除', async () => {
      const id = await seedProduct({ name: '待删除商品' })
      await products.deleteProduct(id)

      const product = await db.products.get(id)
      expect(product!.isActive).toBe(false)
    })

    it('generateBarcode 生成递增条码', async () => {
      const code1 = await products.generateBarcode()
      await seedProduct({ barcode: code1 })
      const code2 = await products.generateBarcode()
      expect(code1).not.toBe(code2)
    })
  })

  // ─── 订单管理 ────────────────────────────────────────────
  describe('orders', () => {
    it('createOrder 创建订单及明细和支付', async () => {
      const orderId = await orders.createOrder(
        {
          orderNo: '20260520-000001',
          status: 'completed',
          totalAmount: 2000,
          discountAmount: 0,
          actualAmount: 2000,
          operatorId: undefined,
          remark: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        [
          { productId: 1, productName: '商品A', barcode: '6900000000001', price: 1000, quantity: 2, discountRate: 100, subtotal: 2000 },
        ],
        [
          { paymentMethod: 'cash', amount: 2000, changeAmount: 0, remark: '', createdAt: Date.now() },
        ],
      )

      expect(orderId).toBeTruthy()

      const items = await orders.getOrderItems(orderId)
      expect(items.length).toBe(1)

      const payments = await orders.getOrderPayments(orderId)
      expect(payments.length).toBe(1)
      expect(payments[0].amount).toBe(2000)
    })

    it('queryOrders 按日期过滤', async () => {
      await orders.createOrder(
        {
          orderNo: '20260101-000001',
          status: 'completed',
          totalAmount: 1000, discountAmount: 0, actualAmount: 1000,
          createdAt: new Date(2026, 0, 1).getTime(),
          updatedAt: Date.now(),
        },
        [{ productId: 1, productName: 'A', barcode: '1', price: 1000, quantity: 1, discountRate: 100, subtotal: 1000 }],
        [{ paymentMethod: 'cash', amount: 1000, changeAmount: 0, createdAt: Date.now() }],
      )

      const result = await orders.queryOrders({ startDate: '2026-01-01', endDate: '2026-01-31', page: 1, pageSize: 10 })
      expect(result.total).toBe(1)
    })

    it('queryOrders 按状态过滤', async () => {
      await orders.createOrder(
        { orderNo: '20260101-000001', status: 'completed', totalAmount: 100, discountAmount: 0, actualAmount: 100, createdAt: Date.now(), updatedAt: Date.now() },
        [],
        [],
      )
      await orders.createOrder(
        { orderNo: '20260101-000002', status: 'refunded', totalAmount: 200, discountAmount: 0, actualAmount: 200, createdAt: Date.now(), updatedAt: Date.now() },
        [],
        [],
      )

      const result = await orders.queryOrders({ status: 'completed', page: 1, pageSize: 10 })
      expect(result.total).toBe(1)
    })

    it('refundOrder 退款', async () => {
      const orderId = await orders.createOrder(
        { orderNo: '20260101-000003', status: 'completed', totalAmount: 500, discountAmount: 0, actualAmount: 500, createdAt: Date.now(), updatedAt: Date.now() },
        [],
        [{ paymentMethod: 'cash', amount: 500, changeAmount: 0, remark: '', createdAt: Date.now() }],
      )

      await orders.refundOrder(orderId)

      const order = await db.orders.get(orderId)
      expect(order!.status).toBe('refunded')

      const payments = await orders.getOrderPayments(orderId)
      expect(payments.length).toBe(2) // 原始 + 退款
      expect(payments[1].amount).toBe(-500)
    })

    it('refundOrder 非完成状态抛异常', async () => {
      const orderId = await orders.createOrder(
        { orderNo: '20260101-000004', status: 'refunded', totalAmount: 500, discountAmount: 0, actualAmount: 500, createdAt: Date.now(), updatedAt: Date.now() },
        [],
        [],
      )

      await expect(orders.refundOrder(orderId)).rejects.toThrow('订单状态不允许退款')
    })

    it('voidOrder 作废订单', async () => {
      const orderId = await orders.createOrder(
        { orderNo: '20260101-000005', status: 'completed', totalAmount: 300, discountAmount: 0, actualAmount: 300, createdAt: Date.now(), updatedAt: Date.now() },
        [],
        [],
      )

      await orders.voidOrder(orderId)

      const order = await db.orders.get(orderId)
      expect(order!.status).toBe('voided')
    })

    it('getSalesStats 销售统计', async () => {
      const now = Date.now()
      await orders.createOrder(
        { orderNo: 'STAT-001', status: 'completed', totalAmount: 1000, discountAmount: 0, actualAmount: 1000, createdAt: now, updatedAt: Date.now() },
        [],
        [{ paymentMethod: 'cash', amount: 1000, changeAmount: 0, createdAt: now }],
      )

      const stats = await orders.getSalesStats(now - 86400000, now + 86400000)
      expect(stats.count).toBe(1)
      expect(stats.total).toBe(1000)
    })

    it('getPaymentStats 支付方式统计', async () => {
      const now = Date.now()
      await orders.createOrder(
        { orderNo: 'PAY-001', status: 'completed', totalAmount: 1000, discountAmount: 0, actualAmount: 1000, createdAt: now, updatedAt: Date.now() },
        [],
        [{ paymentMethod: 'wechat', amount: 1000, changeAmount: 0, createdAt: now }],
      )

      const stats = await orders.getPaymentStats(now - 86400000, now + 86400000)
      expect(stats['wechat']).toBeDefined()
      expect(stats['wechat'].amount).toBe(1000)
    })
  })

  // ─── 会员管理 ────────────────────────────────────────────
  describe('members', () => {
    async function seedMember(overrides: Partial<Member> = {}) {
      return db.members.add({
        phone: overrides.phone || '13800138001',
        name: overrides.name || '张三',
        level: overrides.level || 'bronze',
        points: overrides.points ?? 0,
        totalPoints: overrides.totalPoints ?? 0,
        discountRate: overrides.discountRate ?? 100,
        isActive: overrides.isActive ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    it('addMember / getMemberByPhone', async () => {
      await seedMember({ phone: '13900139001', name: '李四' })
      const member = await members.getMemberByPhone('13900139001')
      expect(member).toBeDefined()
      expect(member!.name).toBe('李四')
    })

    it('getMembers 分页与搜索', async () => {
      await seedMember({ name: '王五', phone: '13800000001' })
      await seedMember({ name: '赵六', phone: '13800000002' })

      const result = await members.getMembers({ keyword: '王五' })
      expect(result.total).toBe(1)
    })

    it('deleteMember 软删除', async () => {
      const id = await seedMember({ name: '测试' })
      await members.deleteMember(id)
      const member = await db.members.get(id)
      expect(member!.isActive).toBe(false)
    })

    it('earnPoints 增加积分', async () => {
      const id = await seedMember({ points: 100, totalPoints: 100 })
      await members.earnPoints(id, 1, 'ORD-001', 50, '消费返积分')

      const member = await db.members.get(id)
      expect(member!.points).toBe(150)
      expect(member!.totalPoints).toBe(150)

      const logs = await members.getMemberPointsLogs(id)
      expect(logs.length).toBe(1)
      expect(logs[0].type).toBe('earn')
      expect(logs[0].points).toBe(50)
    })

    it('earnPoints 会员不存在抛异常', async () => {
      await expect(members.earnPoints(99999, 1, 'ORD-001', 50)).rejects.toThrow('会员不存在')
    })

    it('redeemPoints 兑换积分', async () => {
      const id = await seedMember({ points: 500, totalPoints: 500 })
      await members.redeemPoints(id, 200, '兑换礼品')

      const member = await db.members.get(id)
      expect(member!.points).toBe(300)
      expect(member!.totalPoints).toBe(500) // totalPoints 不减少
    })

    it('redeemPoints 积分不足抛异常', async () => {
      const id = await seedMember({ points: 50 })
      await expect(members.redeemPoints(id, 100)).rejects.toThrow('积分不足')
    })

    it('adjustPoints 手动调整积分', async () => {
      const id = await seedMember({ points: 100, totalPoints: 100 })
      await members.adjustPoints(id, 50, '手动增加')

      const member = await db.members.get(id)
      expect(member!.points).toBe(150)
      expect(member!.totalPoints).toBe(150) // 正数增加 totalPoints
    })

    it('adjustPoints 减少积分不影响 totalPoints', async () => {
      const id = await seedMember({ points: 100, totalPoints: 200 })
      await members.adjustPoints(id, -50, '手动减少')

      const member = await db.members.get(id)
      expect(member!.points).toBe(50)
      expect(member!.totalPoints).toBe(200) // 负数不减少 totalPoints
    })

    it('calcEarnPoints 1元=1积分', () => {
      expect(members.calcEarnPoints(500)).toBe(5)
      expect(members.calcEarnPoints(99)).toBe(0)
      expect(members.calcEarnPoints(0)).toBe(0)
    })

    it('MEMBER_LEVELS 等级配置', () => {
      expect(members.MEMBER_LEVELS).toHaveLength(4)
      expect(members.MEMBER_LEVELS[0].level).toBe('bronze')
      expect(members.MEMBER_LEVELS[3].discountRate).toBe(85)
    })

    it('getLevelLabel 返回等级名称', () => {
      expect(members.getLevelLabel('gold')).toBe('黄金')
      expect(members.getLevelLabel('unknown' as MemberLevel)).toBe('unknown')
    })
  })

  // ─── 促销管理 ────────────────────────────────────────────
  describe('promotions', () => {
    const now = Date.now()
    const yesterday = now - 86400000
    const tomorrow = now + 86400000

    async function seedPromotion(overrides: Partial<Promotion> = {}) {
      return db.promotions.add({
        name: overrides.name || '测试促销',
        type: overrides.type || 'amount_off',
        isActive: overrides.isActive ?? true,
        startDate: overrides.startDate ?? yesterday,
        endDate: overrides.endDate ?? tomorrow,
        thresholdAmount: overrides.thresholdAmount,
        discountRate: overrides.discountRate,
        lockProductId: overrides.lockProductId,
        buyProductId: overrides.buyProductId,
        buyQuantity: overrides.buyQuantity,
        giftProductId: overrides.giftProductId,
        giftQuantity: overrides.giftQuantity,
        applicableLevels: overrides.applicableLevels || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    it('getActivePromotions 仅返回有效期内活动', async () => {
      await seedPromotion({ name: '进行中', startDate: yesterday, endDate: tomorrow })
      await seedPromotion({ name: '已结束', startDate: now - 86400000 * 10, endDate: now - 86400000 * 2, isActive: true })
      await seedPromotion({ name: '未开始', startDate: now + 86400000 * 2, endDate: now + 86400000 * 10, isActive: true })
      await seedPromotion({ name: '已禁用', startDate: yesterday, endDate: tomorrow, isActive: false })

      const active = await promotions.getActivePromotions()
      expect(active.length).toBe(1)
      expect(active[0].name).toBe('进行中')
    })

    it('getActivePromotions 按会员等级过滤', async () => {
      await seedPromotion({ name: '黄金专享', applicableLevels: ['gold'] })

      const gold = await promotions.getActivePromotions('gold')
      expect(gold.length).toBe(1)

      const bronze = await promotions.getActivePromotions('bronze')
      expect(bronze.length).toBe(0)
    })

    it('getAmountPromotion 匹配满减门槛', async () => {
      await seedPromotion({ type: 'amount_off', thresholdAmount: 5000, discountAmount: 500 }) // 满50减5
      await seedPromotion({ type: 'amount_off', thresholdAmount: 10000, discountAmount: 1200 }) // 满100减12

      // 订单 60 元 → 满足第一个
      const promo = await promotions.getAmountPromotion(6000)
      expect(promo).toBeDefined()
      expect(promo!.thresholdAmount).toBe(5000)
    })

    it('getBuyGiftPromotion 买赠匹配', async () => {
      await seedPromotion({ type: 'buy_gift', buyProductId: 1, buyQuantity: 2, giftProductId: 99, giftQuantity: 1 })

      const promo = await promotions.getBuyGiftPromotion(1, 2)
      expect(promo).toBeDefined()

      const noPromo = await promotions.getBuyGiftPromotion(1, 1)
      expect(noPromo).toBeUndefined()
    })

    it('togglePromotion 切换状态', async () => {
      const id = await seedPromotion({ isActive: true })
      await promotions.togglePromotion(id)
      const p = await db.promotions.get(id)
      expect(p!.isActive).toBe(false)
    })

    it('addPromotion / updatePromotion / deletePromotion', async () => {
      const id = await promotions.addPromotion({
        name: '新促销', type: 'percent_off', isActive: true,
        startDate: now, endDate: tomorrow, createdAt: Date.now(), updatedAt: Date.now(),
      })
      expect(id).toBeTruthy()

      await promotions.updatePromotion(id, { name: '修改促销' })
      const p = await db.promotions.get(id)
      expect(p!.name).toBe('修改促销')

      await promotions.deletePromotion(id)
      expect(await db.promotions.get(id)).toBeUndefined()
    })
  })

  // ─── 库存管理 ────────────────────────────────────────────
  describe('inventory', () => {
    let productId: number

    beforeEach(async () => {
      const catId = (await db.categories.toCollection().first())!.id!
      productId = await db.products.add({
        barcode: '6900000000001', name: '库存商品', categoryId: catId,
        price: 1000, costPrice: 500, unit: '个', stock: 50,
        lowStockThreshold: 10, isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
      })
    })

    it('addStockRecord 入库', async () => {
      await inventory.addStockRecord(productId, 'purchase', 100, '采购入库')

      const product = await db.products.get(productId)
      // getProductStock 只计算 stockRecords 表记录，初始 stock=50 不在记录中
      expect(product!.stock).toBe(100) // syncProductStock 重写为 records 累加

      const records = await inventory.getStockRecords({ productId })
      expect(records.total).toBe(1)
      expect(records.list[0].quantity).toBe(100)
      expect(records.list[0].type).toBe('purchase')
    })

    it('addStockRecord 出库', async () => {
      // 先入库，再出库
      await inventory.addStockRecord(productId, 'purchase', 100, '采购入库')
      await inventory.addStockRecord(productId, 'sale', -20, '销售出库')

      const product = await db.products.get(productId)
      expect(product!.stock).toBe(80)
    })

    it('addStockRecord 库存不足抛异常', async () => {
      await expect(inventory.addStockRecord(productId, 'sale', -100)).rejects.toThrow('库存不足')
    })

    it('addStockRecord 商品不存在抛异常', async () => {
      await expect(inventory.addStockRecord(99999, 'purchase', 10)).rejects.toThrow('商品不存在')
    })

    it('getStockList 查询库存列表', async () => {
      const result = await inventory.getStockList()
      expect(result.total).toBeGreaterThanOrEqual(1)
    })

    it('getStockList lowStockOnly 低库存', async () => {
      // 修改商品库存为低于阈值
      await db.products.update(productId, { stock: 5 })
      const result = await inventory.getStockList({ lowStockOnly: true })
      expect(result.total).toBe(1)
    })

    it('getLowStockProducts 返回低库存商品', async () => {
      await db.products.update(productId, { stock: 3, lowStockThreshold: 10 })
      const low = await inventory.getLowStockProducts()
      expect(low.length).toBe(1)
    })

    it('getProductStock 累加库存记录', async () => {
      await inventory.addStockRecord(productId, 'purchase', 100)
      await inventory.addStockRecord(productId, 'purchase', 50)
      expect(await inventory.getProductStock(productId)).toBe(150) // 100 + 50
    })

    it('updateProductStockSetting 更新库存设置', async () => {
      await inventory.updateProductStockSetting(productId, 999, 50)
      const product = await db.products.get(productId)
      expect(product!.stock).toBe(999)
      expect(product!.lowStockThreshold).toBe(50)
    })
  })

  // ─── 报表统计 ────────────────────────────────────────────
  describe('reports', () => {
    let catId: number
    let productId1: number
    let productId2: number

    beforeEach(async () => {
      catId = (await db.categories.toCollection().first())!.id!
      productId1 = await db.products.add({
        barcode: '6900000000001', name: '报表商品A', categoryId: catId,
        price: 1000, costPrice: 500, unit: '个', stock: 100,
        lowStockThreshold: 10, isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
      })
      productId2 = await db.products.add({
        barcode: '6900000000002', name: '报表商品B', categoryId: catId,
        price: 2000, costPrice: 1000, unit: '个', stock: 100,
        lowStockThreshold: 10, isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
      })
    })

    it('getTopProducts 商品排行', async () => {
      const now = Date.now()
      await orders.createOrder(
        { orderNo: 'RPT-001', status: 'completed', totalAmount: 3000, discountAmount: 0, actualAmount: 3000, createdAt: now, updatedAt: Date.now() },
        [
          { productId: productId1, productName: '报表商品A', barcode: '6900000000001', price: 1000, quantity: 2, discountRate: 100, subtotal: 2000 },
          { productId: productId2, productName: '报表商品B', barcode: '6900000000002', price: 2000, quantity: 1, discountRate: 75, subtotal: 1500 },
        ],
        [{ paymentMethod: 'cash', amount: 3000, changeAmount: 0, createdAt: now }],
      )

      const top = await reports.getTopProducts(now - 86400000, now + 86400000)
      expect(top.length).toBe(2)
      // 按总金额排序，商品A 2000 > 商品B 1500
      expect(top[0].productId).toBe(productId1)
      expect(top[0].totalQty).toBe(2)
    })

    it('getTopProducts 空数据返回空数组', async () => {
      const top = await reports.getTopProducts(0, 1)
      expect(top).toEqual([])
    })

    it('getCategoryStats 分类统计', async () => {
      const now = Date.now()
      await orders.createOrder(
        { orderNo: 'CAT-001', status: 'completed', totalAmount: 3000, discountAmount: 0, actualAmount: 3000, createdAt: now, updatedAt: Date.now() },
        [
          { productId: productId1, productName: '报表商品A', barcode: '6900000000001', price: 1000, quantity: 3, discountRate: 100, subtotal: 3000 },
        ],
        [{ paymentMethod: 'cash', amount: 3000, changeAmount: 0, createdAt: now }],
      )

      const stats = await reports.getCategoryStats(now - 86400000, now + 86400000)
      expect(stats.length).toBeGreaterThanOrEqual(1)
      expect(stats[0].totalAmount).toBe(3000)
      expect(stats[0].totalQty).toBe(3)
    })

    it('getDailyTrend 每日趋势', async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startTs = today.getTime()

      // 今天创建一个订单
      await orders.createOrder(
        { orderNo: 'DAY-001', status: 'completed', totalAmount: 1500, discountAmount: 0, actualAmount: 1500, createdAt: Date.now(), updatedAt: Date.now() },
        [
          { productId: productId1, productName: '报表商品A', barcode: '6900000000001', price: 1500, quantity: 1, discountRate: 100, subtotal: 1500 },
        ],
        [{ paymentMethod: 'cash', amount: 1500, changeAmount: 0, createdAt: Date.now() }],
      )

      const trend = await reports.getDailyTrend(startTs, 7)
      expect(trend.length).toBe(7)
      // 今天应有数据
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const todayStat = trend.find(t => t.date === todayStr)
      expect(todayStat).toBeDefined()
      expect(todayStat!.amount).toBe(1500)
      expect(todayStat!.count).toBe(1)
    })
  })

  // ─── 认证与权限 ──────────────────────────────────────────
  describe('auth', () => {
    it('login 管理员登录成功', async () => {
      const result = await auth.login('admin', 'admin123')
      expect(result.success).toBe(true)
      if (!result.success) throw new Error()
      expect(result.user.username).toBe('admin')
    })

    it('login 密码错误', async () => {
      const result = await auth.login('admin', 'wrong')
      expect(result.success).toBe(false)
      if (result.success) throw new Error()
      expect(result.reason).toBe('账号或密码错误')
    })

    it('login 用户不存在', async () => {
      const result = await auth.login('nobody', 'test')
      expect(result.success).toBe(false)
    })

    it('createUser / login 新用户', async () => {
      await auth.createUser({
        username: 'cashier1',
        password: 'pass123',
        realname: '收银员张三',
        roleCode: 'cashier',
      })

      const result = await auth.login('cashier1', 'pass123')
      expect(result.success).toBe(true)
    })

    it('createUser 重复用户名抛异常', async () => {
      await auth.createUser({ username: 'dup1', password: '123', realname: 'A', roleCode: 'cashier' })
      await expect(auth.createUser({ username: 'dup1', password: '456', realname: 'B', roleCode: 'cashier' })).rejects.toThrow('账号已存在')
    })

    it('changePassword 修改密码', async () => {
      const adminUser = await db.users.where('username').equals('admin').first()
      expect(adminUser).toBeTruthy()
      const adminId = adminUser!.id!

      const result = await auth.changePassword(adminId, 'admin123', 'newpass456')
      expect(result.ok).toBe(true)

      // 旧密码不可用
      const loginResult = await auth.login('admin', 'admin123')
      expect(loginResult.success).toBe(false)

      // 新密码可用
      const newResult = await auth.login('admin', 'newpass456')
      expect(newResult.success).toBe(true)
    })

    it('hasPermission admin 通配符', () => {
      expect(auth.hasPermission(['*'], 'any.permission')).toBe(true)
    })

    it('hasPermission 有权限返回 true', () => {
      expect(auth.hasPermission(['cashier.sale', 'product.view'], 'cashier.sale')).toBe(true)
    })

    it('hasPermission 无权限返回 false', () => {
      expect(auth.hasPermission(['cashier.sale'], 'product.create')).toBe(false)
    })

    it('hasPermission 空数组返回 false', () => {
      expect(auth.hasPermission([], 'cashier.sale')).toBe(false)
    })

    it('getRoles 返回角色列表', async () => {
      const roles = await auth.getRoles()
      expect(roles.length).toBe(3)
      expect(roles[0].code).toBe('admin')
    })

    it('createRole / updateRole / deleteRole', async () => {
      const role = await auth.createRole({
        code: 'custom',
        name: '自定义角色',
        permissions: ['cashier.sale'],
        sortOrder: 10,
      })
      expect(role.code).toBe('custom')

      await auth.updateRole('custom', { name: '修改角色名' })
      const updated = await auth.getRoleByCode('custom')
      expect(updated!.name).toBe('修改角色名')

      const delResult = await auth.deleteRole('custom')
      expect(delResult.ok).toBe(true)
    })

    it('deleteRole 系统内置角色不可删除', async () => {
      const result = await auth.deleteRole('admin')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('不可删除')
    })

    it('deleteRole 有用户使用不可删除', async () => {
      const result = await auth.deleteRole('admin')
      // admin 角色有用户使用
      expect(result.ok).toBe(false)
    })

    it('getLoginLogs 记录登录日志', async () => {
      await auth.login('admin', 'admin123')
      await auth.login('admin', 'wrongpass')

      const logs = await auth.getLoginLogs()
      expect(logs.total).toBe(2)
    })

    it('logOperation / getOperationLogs', async () => {
      await auth.logOperation({ userId: 1, username: 'admin', action: '测试操作', targetType: 'product', targetId: 1, detail: '测试详情' })

      const logs = await auth.getOperationLogs({ action: '测试操作' })
      expect(logs.total).toBe(1)
    })

    it('getUsers 分页与搜索', async () => {
      const result = await auth.getUsers({ keyword: 'admin' })
      expect(result.total).toBeGreaterThanOrEqual(1)
    })

    it('updateUser / deleteUser', async () => {
      const user = await auth.createUser({ username: 'toUpdate', password: '123', realname: '原始', roleCode: 'cashier' })
      await auth.updateUser(user.id!, { realname: '已修改' })
      const updated = await auth.getUserById(user.id!)
      expect(updated!.realname).toBe('已修改')

      await auth.deleteUser(user.id!)
      expect(await auth.getUserById(user.id!)).toBeUndefined()
    })
  })
})
