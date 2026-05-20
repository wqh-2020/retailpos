import { describe, it, expect, beforeEach } from 'vitest'
import { db, initDefaultData } from '@/db'
import { parseImportRows, groupByOrder, importOrders, getImportTemplateData, getImportTemplateHeaders } from '@/db/import-orders'

describe('import-orders', () => {
  beforeEach(async () => {
    const tableNames = db.tables.map(t => t.name)
    await Promise.all(tableNames.map(name => db.table(name).clear()))
    await initDefaultData()
  })

  // ─── parseImportRows ──────────────────────────────────────
  describe('parseImportRows', () => {
    it('正常行无错误', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试商品',
        '条码': '6900000001',
        '数量': 2,
        '单价(元)': 10,
        '小计(元)': 20,
        '折扣率(%)': 100,
        '支付方式': '现金',
        '实收金额(元)': 20,
      }]
      const { results, errors } = parseImportRows(rows)
      expect(errors).toHaveLength(0)
      expect(results).toHaveLength(1)
      expect(results[0].errors).toHaveLength(0)
      expect(results[0].row.orderNo).toBe('IMP-001')
      expect(results[0].row.quantity).toBe(2)
      expect(results[0].row.priceYuan).toBe(10)
    })

    it('缺少必填字段报错', () => {
      const rows = [{ '商品名称': '测试' }]
      const { results, errors } = parseImportRows(rows)
      expect(results[0].errors).toContain('缺少订单号')
      expect(results[0].errors).toContain('缺少交易时间')
      expect(results[0].errors).toContain('缺少支付方式')
    })

    it('交易时间格式错误', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': 'not-a-date',
        '商品名称': '测试',
        '数量': 1,
        '单价(元)': 10,
        '小计(元)': 10,
        '支付方式': '现金',
        '实收金额(元)': 10,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].errors).toContain('交易时间格式错误')
    })

    it('数量非正数报错', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试',
        '数量': 0,
        '单价(元)': 10,
        '小计(元)': 0,
        '支付方式': '现金',
        '实收金额(元)': 0,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].errors).toContain('数量必须大于0')
    })

    it('数量为负数报错', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试',
        '数量': -1,
        '单价(元)': 10,
        '小计(元)': -10,
        '支付方式': '现金',
        '实收金额(元)': -10,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].errors).toContain('数量必须大于0')
      expect(results[0].errors).toContain('小计不合法')
      expect(results[0].errors).toContain('实收金额不合法')
    })

    it('折扣率超出范围报错', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试',
        '数量': 1,
        '单价(元)': 10,
        '小计(元)': 10,
        '折扣率(%)': 150,
        '支付方式': '现金',
        '实收金额(元)': 10,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].errors).toContain('折扣率应在0-100之间')
    })

    it('折扣率为0合法', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试',
        '数量': 1,
        '单价(元)': 10,
        '小计(元)': 0,
        '折扣率(%)': 0,
        '支付方式': '现金',
        '实收金额(元)': 0,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].errors).toHaveLength(0)
    })

    it('折扣率缺失不报错（可选字段）', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试',
        '数量': 1,
        '单价(元)': 10,
        '小计(元)': 10,
        '支付方式': '现金',
        '实收金额(元)': 10,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].errors).toHaveLength(0)
      expect(results[0].row.discountRate).toBeUndefined()
    })

    it('统计错误行数', () => {
      const rows = [
        { '订单号': 'IMP-001', '交易时间': '2025-01-01 09:00:00', '商品名称': 'OK', '数量': 1, '单价(元)': 10, '小计(元)': 10, '支付方式': '现金', '实收金额(元)': 10 },
        { '商品名称': 'BAD' }, // 缺少多个字段
      ]
      const { results, errors } = parseImportRows(rows)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('共 1 行数据存在错误')
      expect(results).toHaveLength(2)
    })

    it('行号正确计算（startIndex=0 时从1开始）', () => {
      const rows = [
        { '订单号': 'A', '交易时间': '2025-01-01', '商品名称': 'T', '数量': 1, '单价(元)': 1, '小计(元)': 1, '支付方式': '现金', '实收金额(元)': 1 },
        { '订单号': 'B', '交易时间': '2025-01-01', '商品名称': 'T', '数量': 1, '单价(元)': 1, '小计(元)': 1, '支付方式': '现金', '实收金额(元)': 1 },
      ]
      const { results } = parseImportRows(rows)
      expect(results[0].index).toBe(1)
      expect(results[1].index).toBe(2)
    })

    it('startIndex 偏移行号', () => {
      const rows = [
        { '订单号': 'A', '交易时间': '2025-01-01', '商品名称': 'T', '数量': 1, '单价(元)': 1, '小计(元)': 1, '支付方式': '现金', '实收金额(元)': 1 },
      ]
      const { results } = parseImportRows(rows, 5)
      expect(results[0].index).toBe(6)
    })

    it('空数组返回空结果', () => {
      const { results, errors } = parseImportRows([])
      expect(results).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })

    it('条码为空字符串转为 undefined', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试',
        '条码': '',
        '数量': 1,
        '单价(元)': 10,
        '小计(元)': 10,
        '支付方式': '现金',
        '实收金额(元)': 10,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].row.barcode).toBeUndefined()
    })

    it('备注为空字符串转为 undefined', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025-01-01 09:00:00',
        '商品名称': '测试',
        '数量': 1,
        '单价(元)': 10,
        '小计(元)': 10,
        '支付方式': '现金',
        '实收金额(元)': 10,
        '备注': '  ',
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].row.remark).toBeUndefined()
    })

    it('YYYY/MM/DD 时间格式兼容', () => {
      const rows = [{
        '订单号': 'IMP-001',
        '交易时间': '2025/01/01 09:00:00',
        '商品名称': '测试',
        '数量': 1,
        '单价(元)': 10,
        '小计(元)': 10,
        '支付方式': '现金',
        '实收金额(元)': 10,
      }]
      const { results } = parseImportRows(rows)
      expect(results[0].errors).toHaveLength(0)
    })
  })

  // ─── groupByOrder ────────────────────────────────────────
  describe('groupByOrder', () => {
    function makeValid(orderNo: string, productName: string, paymentMethod: string, actualAmount: number, opts: Record<string, any> = {}) {
      return {
        row: {
          orderNo,
          tradeTime: '2025-01-01 09:00:00',
          productName,
          barcode: opts.barcode || '6900000001',
          quantity: 1,
          priceYuan: 10,
          subtotalYuan: 10,
          discountRate: 100,
          paymentMethod,
          actualAmountYuan: actualAmount,
          remark: '',
        },
        index: 1,
        errors: [] as string[],
      }
    }

    it('单行数据产生一个订单', () => {
      const validated = [makeValid('IMP-001', '商品A', '现金', 10)]
      const groups = groupByOrder(validated)
      expect(groups).toHaveLength(1)
      expect(groups[0].orderNo).toBe('IMP-001')
      expect(groups[0].items).toHaveLength(1)
      expect(groups[0].actualAmount).toBe(1000) // 10元=1000分
    })

    it('多行同一订单号合并为一个订单', () => {
      const validated = [
        makeValid('IMP-001', '商品A', '现金', 30, { barcode: '6900000001' }),
        makeValid('IMP-001', '商品B', '现金', 30, { barcode: '6900000002' }),
      ]
      const groups = groupByOrder(validated)
      expect(groups).toHaveLength(1)
      expect(groups[0].items).toHaveLength(2)
      expect(groups[0].items[0].productName).toBe('商品A')
      expect(groups[0].items[1].productName).toBe('商品B')
    })

    it('不同订单号产生不同订单', () => {
      const validated = [
        makeValid('IMP-001', '商品A', '现金', 10),
        makeValid('IMP-002', '商品B', '微信', 20),
      ]
      const groups = groupByOrder(validated)
      expect(groups).toHaveLength(2)
      expect(groups[0].paymentMethod).toBe('cash')
      expect(groups[1].paymentMethod).toBe('wechat')
    })

    it('金额正确转换为分', () => {
      const validated = [makeValid('IMP-001', '商品A', '现金', 38.5)]
      const groups = groupByOrder(validated)
      expect(groups[0].actualAmount).toBe(3850)
      expect(groups[0].items[0].price).toBe(1000) // 10元
      expect(groups[0].items[0].subtotal).toBe(1000)
    })

    it('有错误的行被跳过', () => {
      const badRow = makeValid('BAD', 'X', '现金', 10)
      badRow.errors = ['缺少订单号']
      const validated = [
        makeValid('GOOD', 'A', '现金', 10),
        badRow,
      ]
      const groups = groupByOrder(validated)
      expect(groups).toHaveLength(1)
      expect(groups[0].orderNo).toBe('GOOD')
    })

    it('全部有错误返回空数组', () => {
      const badRow = makeValid('BAD', 'X', '现金', 10)
      badRow.errors = ['缺少订单号']
      const groups = groupByOrder([badRow])
      expect(groups).toHaveLength(0)
    })

    it('空数组返回空', () => {
      expect(groupByOrder([])).toHaveLength(0)
    })

    it('支付方式中文映射', () => {
      const cases: [string, string][] = [
        ['现金', 'cash'],
        ['微信', 'wechat'],
        ['微信支付', 'wechat'],
        ['支付宝', 'alipay'],
        ['银行卡', 'bankcard'],
        ['其他', 'other'],
      ]
      for (const [cn, en] of cases) {
        const validated = [makeValid('IMP-001', 'A', cn, 10)]
        const groups = groupByOrder(validated)
        expect(groups[0].paymentMethod).toBe(en)
      }
    })

    it('未知支付方式降级为 other', () => {
      const validated = [makeValid('IMP-001', 'A', 'PayPal', 10)]
      const groups = groupByOrder(validated)
      expect(groups[0].paymentMethod).toBe('other')
    })

    it('折扣率默认100', () => {
      const row = makeValid('IMP-001', 'A', '现金', 10)
      ;(row.row as any).discountRate = undefined
      const groups = groupByOrder([row])
      expect(groups[0].items[0].discountRate).toBe(100)
    })

    it('无条码时 barcode 为空字符串', () => {
      const row = makeValid('IMP-001', 'A', '现金', 10)
      row.row.barcode = undefined
      const groups = groupByOrder([row])
      expect(groups[0].items[0].barcode).toBe('')
    })
  })

  // ─── importOrders ────────────────────────────────────────
  describe('importOrders', () => {
    it('空数组返回 0', async () => {
      expect(await importOrders([])).toBe(0)
    })

    it('导入单笔订单写入 orders/orderItems/payments', async () => {
      const orders = [{
        orderNo: 'IMP-TEST-001',
        createdAt: new Date('2025-03-15 10:00:00').getTime(),
        items: [{
          productName: '导入商品A',
          barcode: '9990000001',
          price: 1500,  // 15元
          quantity: 2,
          discountRate: 100,
          subtotal: 3000,
        }],
        paymentMethod: 'cash',
        actualAmount: 3000,
        remark: '测试导入',
      }]

      const count = await importOrders(orders)
      expect(count).toBe(1)

      // 验证订单
      const order = await db.orders.where('orderNo').equals('IMP-TEST-001').first()
      expect(order).toBeDefined()
      expect(order!.status).toBe('completed')
      expect(order!.actualAmount).toBe(3000)
      expect(order!.totalAmount).toBe(3000)

      // 验证明细
      const items = await db.orderItems.where('orderId').equals(order!.id!).toArray()
      expect(items).toHaveLength(1)
      expect(items[0].productName).toBe('导入商品A')
      expect(items[0].quantity).toBe(2)

      // 验证支付
      const payments = await db.payments.where('orderId').equals(order!.id!).toArray()
      expect(payments).toHaveLength(1)
      expect(payments[0].paymentMethod).toBe('cash')
      expect(payments[0].amount).toBe(3000)
    })

    it('导入多商品订单产生多条明细', async () => {
      const orders = [{
        orderNo: 'IMP-MULTI-001',
        createdAt: new Date('2025-03-15 10:00:00').getTime(),
        items: [
          { productName: '商品A', barcode: '9990000001', price: 1000, quantity: 2, discountRate: 100, subtotal: 2000 },
          { productName: '商品B', barcode: '9990000002', price: 500, quantity: 3, discountRate: 100, subtotal: 1500 },
          { productName: '商品C', barcode: '9990000003', price: 2000, quantity: 1, discountRate: 100, subtotal: 2000 },
        ],
        paymentMethod: 'wechat',
        actualAmount: 5500,
        remark: '',
      }]

      const count = await importOrders(orders)
      expect(count).toBe(1)

      const order = await db.orders.where('orderNo').equals('IMP-MULTI-001').first()
      expect(order!.totalAmount).toBe(5500)

      const items = await db.orderItems.where('orderId').equals(order!.id!).toArray()
      expect(items).toHaveLength(3)
    })

    it('导入多笔订单', async () => {
      const orders = [
        {
          orderNo: 'IMP-ORDER-A',
          createdAt: new Date('2025-03-15 09:00:00').getTime(),
          items: [{ productName: 'A', barcode: 'AAA001', price: 1000, quantity: 1, discountRate: 100, subtotal: 1000 }],
          paymentMethod: 'cash',
          actualAmount: 1000,
          remark: '',
        },
        {
          orderNo: 'IMP-ORDER-B',
          createdAt: new Date('2025-03-15 10:00:00').getTime(),
          items: [{ productName: 'B', barcode: 'BBB001', price: 2000, quantity: 1, discountRate: 100, subtotal: 2000 }],
          paymentMethod: 'alipay',
          actualAmount: 2000,
          remark: '',
        },
      ]

      const count = await importOrders(orders)
      expect(count).toBe(2)

      const allOrders = await db.orders.toArray()
      expect(allOrders).toHaveLength(2)
    })

    it('自动创建不存在的商品', async () => {
      const orders = [{
        orderNo: 'IMP-AUTO-PROD',
        createdAt: new Date('2025-03-15 10:00:00').getTime(),
        items: [{ productName: '全新商品', barcode: 'NEW-PROD-001', price: 888, quantity: 1, discountRate: 100, subtotal: 888 }],
        paymentMethod: 'cash',
        actualAmount: 888,
        remark: '',
      }]

      await importOrders(orders)

      const product = await db.products.where('barcode').equals('NEW-PROD-001').first()
      expect(product).toBeDefined()
      expect(product!.name).toBe('全新商品')
      expect(product!.isActive).toBe(true)
    })

    it('已有商品不重复创建', async () => {
      // 先创建一个商品
      const existingId = await db.products.add({
        barcode: 'EXIST-001',
        name: '已有商品',
        categoryId: (await db.categories.toCollection().first())!.id!,
        price: 1000,
        unit: '个',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const orders = [{
        orderNo: 'IMP-EXIST-001',
        createdAt: new Date('2025-03-15 10:00:00').getTime(),
        items: [{ productName: '已有商品', barcode: 'EXIST-001', price: 1500, quantity: 1, discountRate: 100, subtotal: 1500 }],
        paymentMethod: 'cash',
        actualAmount: 1500,
        remark: '',
      }]

      await importOrders(orders)

      const productCount = await db.products.count()
      // initDefaultData 不会创建商品，只有我们手动创建的1个 + 其他分类
      // 导入时应复用已有商品，不新增
      const existingProduct = await db.products.get(existingId)
      expect(existingProduct).toBeDefined()

      const items = await db.orderItems.toArray()
      expect(items[0].productId).toBe(existingId)
    })

    it('导入的订单参与报表统计', async () => {
      const orders = [
        {
          orderNo: 'IMP-STAT-001',
          createdAt: new Date('2025-06-01 10:00:00').getTime(),
          items: [
            { productName: '商品X', barcode: 'STAT-X-001', price: 1000, quantity: 3, discountRate: 100, subtotal: 3000 },
            { productName: '商品Y', barcode: 'STAT-Y-001', price: 2000, quantity: 1, discountRate: 100, subtotal: 2000 },
          ],
          paymentMethod: 'wechat',
          actualAmount: 5000,
          remark: '',
        },
      ]

      await importOrders(orders)

      // 验证 getSalesStats
      const { getSalesStats } = await import('@/db/orders')
      const start = new Date('2025-06-01 00:00:00').getTime()
      const end = new Date('2025-06-01 23:59:59').getTime()
      const stats = await getSalesStats(start, end)
      expect(stats.count).toBe(1)
      expect(stats.total).toBe(5000)
    })

    it('导入时间正确存储（历史数据）', async () => {
      const histTime = new Date('2024-01-01 08:00:00').getTime()
      const orders = [{
        orderNo: 'IMP-HIST-001',
        createdAt: histTime,
        items: [{ productName: '历史商品', barcode: 'HIST-001', price: 500, quantity: 1, discountRate: 100, subtotal: 500 }],
        paymentMethod: 'cash',
        actualAmount: 500,
        remark: '',
      }]

      await importOrders(orders)

      const order = await db.orders.where('orderNo').equals('IMP-HIST-001').first()
      expect(order!.createdAt).toBe(histTime)
    })
  })

  // ─── getImportTemplateData ────────────────────────────────
  describe('getImportTemplateData', () => {
    it('返回 2 行示例数据', () => {
      const data = getImportTemplateData()
      expect(data).toHaveLength(2)
      expect(data[0]['订单号']).toBe('IMP-20250101-001')
      expect(data[1]['订单号']).toBe('IMP-20250101-001')
      expect(data[0]['商品名称']).toBe('示例商品A')
      expect(data[1]['商品名称']).toBe('示例商品B')
    })

    it('示例数据通过 parseImportRows 校验', () => {
      const data = getImportTemplateData()
      const { results, errors } = parseImportRows(data)
      expect(errors).toHaveLength(0)
      expect(results.every(r => r.errors.length === 0)).toBe(true)
    })

    it('同一订单号所有行的实收金额一致', () => {
      const data = getImportTemplateData()
      const amounts = new Set(data.map(r => r['实收金额(元)']))
      expect(amounts.size).toBe(1)
    })
  })

  // ─── getImportTemplateHeaders ─────────────────────────────
  describe('getImportTemplateHeaders', () => {
    it('包含所有 11 个列头', () => {
      const headers = getImportTemplateHeaders()
      expect(headers).toHaveLength(11)
      expect(headers).toContain('订单号')
      expect(headers).toContain('交易时间')
      expect(headers).toContain('商品名称')
      expect(headers).toContain('条码')
      expect(headers).toContain('数量')
      expect(headers).toContain('单价(元)')
      expect(headers).toContain('小计(元)')
      expect(headers).toContain('折扣率(%)')
      expect(headers).toContain('支付方式')
      expect(headers).toContain('实收金额(元)')
      expect(headers).toContain('备注')
    })

    it('列头顺序与模板数据字段一一对应', () => {
      const headers = getImportTemplateHeaders()
      const data = getImportTemplateData()
      expect(data[0]).toHaveProperty(headers[0]) // 订单号
      expect(data[0]).toHaveProperty(headers[headers.length - 1]) // 备注
    })
  })
})
