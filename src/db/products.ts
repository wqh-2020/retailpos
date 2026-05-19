import { db } from './index'
import type { Product, Category } from '@/types'

// ─── 分类 ───────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray()
}

export async function addCategory(data: Omit<Category, 'id'>): Promise<number> {
  return db.categories.add(data)
}

export async function updateCategory(id: number, data: Partial<Category>): Promise<void> {
  await db.categories.update(id, data)
}

export async function deleteCategory(id: number): Promise<void> {
  await db.categories.delete(id)
}

// ─── 商品 ───────────────────────────────────────────────

export async function getProducts(opts?: {
  categoryId?: number
  keyword?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<{ list: Product[]; total: number }> {
  let collection = db.products.filter((p) => {
    if (opts?.isActive !== undefined && p.isActive !== opts.isActive) return false
    if (opts?.categoryId && p.categoryId !== opts.categoryId) return false
    if (opts?.keyword) {
      const kw = opts.keyword.toLowerCase()
      return p.name.toLowerCase().includes(kw) || p.barcode.includes(kw)
    }
    return true
  })

  const total = await collection.count()
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20
  const list = await collection
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .toArray()

  return { list, total }
}

export async function searchProducts(keyword: string): Promise<Product[]> {
  const kw = keyword.toLowerCase()
  return db.products
    .filter((p) => p.isActive && (p.name.toLowerCase().includes(kw) || p.barcode.includes(kw)))
    .limit(20)
    .toArray()
}

export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  return db.products.where('barcode').equals(barcode).first()
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return db.products.get(id)
}

export async function addProduct(data: Omit<Product, 'id'>): Promise<number> {
  return db.products.add(data)
}

export async function updateProduct(id: number, data: Partial<Product>): Promise<void> {
  await db.products.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteProduct(id: number): Promise<void> {
  // 软删除
  await db.products.update(id, { isActive: false, updatedAt: Date.now() })
}

export async function bulkAddProducts(items: Omit<Product, 'id'>[]): Promise<void> {
  await db.products.bulkPut(items as Product[])
}

/** 生成下一个内部条码（前缀200 + 10位序号） */
export async function generateBarcode(): Promise<string> {
  const count = await db.products.count()
  const seq = String(count + 1).padStart(10, '0')
  return `200${seq}`
}
