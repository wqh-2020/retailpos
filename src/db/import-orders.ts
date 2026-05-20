import { db } from './index'
import type { Order, OrderItem, Payment } from '@/types'
import { yuanToFen } from '@/utils/money'
import * as XLSX from 'xlsx'

// ─── Excel 行映射 ─────────────────────────────────────────

export interface ImportRow {
  orderNo: string
  tradeTime: string
  productName: string
  barcode?: string
  quantity: number
  priceYuan: number
  subtotalYuan: number
  discountRate?: number
  paymentMethod: string
  actualAmountYuan: number
  remark?: string
}

/** 解析后按订单号分组的结果 */
export interface ParsedOrder {
  orderNo: string
  createdAt: number
  items: {
    productName: string
    barcode: string
    price: number        // 分
    quantity: number
    discountRate: number  // 0-100
    subtotal: number      // 分
  }[]
  paymentMethod: string
  actualAmount: number    // 分
  remark: string
}

/** 校验结果 */
export interface ValidateResult {
  row: ImportRow
  index: number
  errors: string[]
}

// ─── 支付方式映射 ─────────────────────────────────────────

const PAYMENT_MAP: Record<string, string> = {
  '现金': 'cash',
  '微信': 'wechat',
  '微信支付': 'wechat',
  '支付宝': 'alipay',
  '银行卡': 'bankcard',
  '其他': 'other',
}

function resolvePaymentMethod(raw: string): string {
  const trimmed = (raw || '').trim()
  return PAYMENT_MAP[trimmed] ?? (Object.values(PAYMENT_MAP).includes(trimmed) ? trimmed : 'other')
}

// ─── 解析 Excel 行 ────────────────────────────────────────

/**
 * 将 Excel 原始行数组解析为 ImportRow[]，并进行基础校验
 */
export function parseImportRows(
  rows: Record<string, unknown>[],
  startIndex = 0
): { results: ValidateResult[]; errors: string[] } {
  const results: ValidateResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowErrors: string[] = []
    const lineNo = startIndex + i + 1  // Excel 行号（1-based）

    const orderNo = String(r['订单号'] ?? '').trim()
    const tradeTime = String(r['交易时间'] ?? '').trim()
    const productName = String(r['商品名称'] ?? '').trim()
    const barcode = String(r['条码'] ?? '').trim() || undefined
    const quantity = Number(r['数量'])
    const priceYuan = Number(r['单价(元)'])
    const subtotalYuan = Number(r['小计(元)'])
    const discountRate = r['折扣率(%)'] !== undefined ? Number(r['折扣率(%)']) : undefined
    const paymentMethod = String(r['支付方式'] ?? '').trim()
    const actualAmountYuan = Number(r['实收金额(元)'])
    const remark = String(r['备注'] ?? '').trim() || undefined

    if (!orderNo) rowErrors.push('缺少订单号')
    if (!tradeTime) rowErrors.push('缺少交易时间')
    else if (isNaN(new Date(tradeTime).getTime())) rowErrors.push('交易时间格式错误')
    if (!productName) rowErrors.push('缺少商品名称')
    if (isNaN(quantity) || quantity <= 0) rowErrors.push('数量必须大于0')
    if (isNaN(priceYuan) || priceYuan < 0) rowErrors.push('单价不合法')
    if (isNaN(subtotalYuan) || subtotalYuan < 0) rowErrors.push('小计不合法')
    if (discountRate !== undefined && (discountRate < 0 || discountRate > 100)) rowErrors.push('折扣率应在0-100之间')
    if (!paymentMethod) rowErrors.push('缺少支付方式')
    if (isNaN(actualAmountYuan) || actualAmountYuan < 0) rowErrors.push('实收金额不合法')

    results.push({
      row: {
        orderNo, tradeTime, productName, barcode, quantity,
        priceYuan, subtotalYuan, discountRate, paymentMethod,
        actualAmountYuan, remark,
      },
      index: lineNo,
      errors: rowErrors,
    })
  }

  const errorCount = results.filter(r => r.errors.length > 0).length
  const errors: string[] = []
  if (errorCount > 0) {
    errors.push(`共 ${errorCount} 行数据存在错误`)
  }

  return { results, errors }
}

/**
 * 将校验通过的行按订单号分组为 ParsedOrder[]
 */
export function groupByOrder(validated: ValidateResult[]): ParsedOrder[] {
  const groupMap = new Map<string, {
    createdAt: number
    items: ParsedOrder['items']
    paymentMethod: string
    actualAmount: number
    remark: string
  }>()

  for (const v of validated) {
    if (v.errors.length > 0) continue

    const r = v.row
    const ts = new Date(r.tradeTime).getTime()
    const payMethod = resolvePaymentMethod(r.paymentMethod)
    const dr = r.discountRate ?? 100

    let group = groupMap.get(r.orderNo)
    if (!group) {
      group = {
        createdAt: ts,
        items: [],
        paymentMethod: payMethod,
        actualAmount: Math.round(r.actualAmountYuan * 100),
        remark: r.remark ?? '',
      }
      groupMap.set(r.orderNo, group)
    }

    group.items.push({
      productName: r.productName,
      barcode: r.barcode ?? '',
      price: Math.round(r.priceYuan * 100),
      quantity: r.quantity,
      discountRate: dr,
      subtotal: Math.round(r.subtotalYuan * 100),
    })
  }

  return [...groupMap.entries()].map(([orderNo, g]) => ({
    orderNo,
    createdAt: g.createdAt,
    items: g.items,
    paymentMethod: g.paymentMethod,
    actualAmount: g.actualAmount,
    remark: g.remark,
  }))
}

// ─── 商品/分类自动查找或创建 ─────────────────────────────

async function ensureProduct(barcode: string, name: string): Promise<number> {
  // 优先按条码查找
  if (barcode) {
    const existing = await db.products.where('barcode').equals(barcode).first()
    if (existing) return existing.id!
  }

  // 按名称查找
  const byName = await db.products.where('name').equals(name).first()
  if (byName) return byName.id!

  // 自动创建
  const categories = await db.categories.toArray()
  const otherCat = categories.find(c => c.name === '其他') ?? categories[0]
  const catId = otherCat?.id ?? 0

  return db.products.add({
    barcode: barcode || `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    categoryId: catId,
    price: 0, // 导入时以明细单价为准
    unit: '个',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

// ─── 批量导入 ────────────────────────────────────────────

/**
 * 将分组后的订单数据写入数据库（事务）
 * 返回导入的订单数量
 */
export async function importOrders(orders: ParsedOrder[]): Promise<number> {
  if (!orders.length) return 0

  // 预处理：查找或创建所有商品
  const productCache = new Map<string, Promise<number>>()

  async function getProductId(barcode: string, name: string): Promise<number> {
    const cacheKey = `${barcode}|${name}`
    if (!productCache.has(cacheKey)) {
      productCache.set(cacheKey, ensureProduct(barcode, name))
    }
    return productCache.get(cacheKey)!
  }

  // 预解析所有商品 ID
  const productIds: Map<string, number> = new Map()
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.barcode}|${item.productName}`
      if (!productIds.has(key)) {
        productIds.set(key, await getProductId(item.barcode, item.productName))
      }
    }
  }

  let count = 0
  await db.transaction('rw', [db.orders, db.orderItems, db.payments], async () => {
    for (const order of orders) {
      const now = Date.now()
      const orderId = await db.orders.add({
        orderNo: order.orderNo,
        status: 'completed',
        totalAmount: order.items.reduce((s, it) => s + it.subtotal, 0),
        discountAmount: 0,
        actualAmount: order.actualAmount,
        createdAt: order.createdAt,
        updatedAt: now,
      })

      const orderItems: Omit<OrderItem, 'id'>[] = order.items.map(it => ({
        orderId,
        productId: productIds.get(`${it.barcode}|${it.productName}`) ?? 0,
        productName: it.productName,
        barcode: it.barcode,
        price: it.price,
        quantity: it.quantity,
        discountRate: it.discountRate,
        subtotal: it.subtotal,
      }))

      await db.orderItems.bulkAdd(orderItems)

      await db.payments.add({
        orderId,
        paymentMethod: order.paymentMethod as any,
        amount: order.actualAmount,
        changeAmount: 0,
        remark: order.remark || '导入流水',
        createdAt: order.createdAt,
      })

      count++
    }
  })

  return count
}

// ─── 生成并下载导入模板 ──────────────────────────────────

/**
 * 获取模板列头定义（有序）
 */
export function getImportTemplateHeaders(): string[] {
  return ['订单号', '交易时间', '商品名称', '条码', '数量', '单价(元)', '小计(元)', '折扣率(%)', '支付方式', '实收金额(元)', '备注']
}

/**
 * 获取模板示例数据
 */
export function getImportTemplateData(): Record<string, unknown>[] {
  return [
    {
      '订单号': 'IMP-20250101-001',
      '交易时间': '2025-01-01 09:30:00',
      '商品名称': '示例商品A',
      '条码': '6901234567890',
      '数量': 2,
      '单价(元)': 15.00,
      '小计(元)': 30.00,
      '折扣率(%)': 100,
      '支付方式': '现金',
      '实收金额(元)': 38.50,
      '备注': '',
    },
    {
      '订单号': 'IMP-20250101-001',
      '交易时间': '2025-01-01 09:30:00',
      '商品名称': '示例商品B',
      '条码': '6901234567891',
      '数量': 1,
      '单价(元)': 8.50,
      '小计(元)': 8.50,
      '折扣率(%)': 100,
      '支付方式': '现金',
      '实收金额(元)': 38.50,
      '备注': '',
    },
  ]
}

/**
 * 直接下载导入模板 Excel 文件
 * 使用 XLSX.writeFileXLSX 确保浏览器和 Electron 环境都能正确写入
 */
export function downloadImportTemplate(fileName = '流水导入模板.xlsx'): void {
  const headers = getImportTemplateHeaders()
  const data = getImportTemplateData()

  // 用 aoa_to_sheet 保证列头始终存在
  const aoa: (string | number)[][] = [
    headers,
    ...data.map(row => headers.map(h => (row as any)[h] ?? '')),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // 设置列宽，方便查看
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2 + 2, 12) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入模板')
  XLSX.writeFileXLSX(wb, fileName)
}
