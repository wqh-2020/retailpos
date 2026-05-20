import { describe, it, expect } from 'vitest'
import { fenToYuan, yuanToFen, formatMoney, applyDiscount, formatYuan, formatDate, formatDateOnly } from '@/utils/money'

describe('money.ts', () => {
  // ─── fenToYuan ───────────────────────────────────────────
  describe('fenToYuan', () => {
    it('分转元 - 基本转换', () => {
      expect(fenToYuan(100)).toBe('1.00')
    })

    it('分转元 - 零值', () => {
      expect(fenToYuan(0)).toBe('0.00')
    })

    it('分转元 - 带小数', () => {
      expect(fenToYuan(1050)).toBe('10.50')
    })

    it('分转元 - 不足一元', () => {
      expect(fenToYuan(1)).toBe('0.01')
      expect(fenToYuan(99)).toBe('0.99')
    })

    it('分转元 - 大额', () => {
      expect(fenToYuan(99999999)).toBe('999999.99')
    })
  })

  // ─── yuanToFen ───────────────────────────────────────────
  describe('yuanToFen', () => {
    it('元转分 - 字符串输入', () => {
      expect(yuanToFen('1.00')).toBe(100)
    })

    it('元转分 - 数字输入', () => {
      expect(yuanToFen(1.5)).toBe(150)
    })

    it('元转分 - 零值', () => {
      expect(yuanToFen(0)).toBe(0)
    })

    it('元转分 - 四舍五入', () => {
      expect(yuanToFen(1.005)).toBe(100) // 浮点精度
      expect(yuanToFen(1.004)).toBe(100)
    })
  })

  // ─── formatMoney ─────────────────────────────────────────
  describe('formatMoney', () => {
    it('格式化为人民币显示', () => {
      expect(formatMoney(100)).toBe('¥1.00')
    })

    it('格式化 - 零值', () => {
      expect(formatMoney(0)).toBe('¥0.00')
    })

    it('格式化 - 大额', () => {
      expect(formatMoney(123456)).toBe('¥1234.56')
    })
  })

  // ─── applyDiscount ───────────────────────────────────────
  describe('applyDiscount', () => {
    it('无折扣 - 100%', () => {
      expect(applyDiscount(1000, 2, 100)).toBe(2000)
    })

    it('9折', () => {
      expect(applyDiscount(1000, 2, 90)).toBe(1800)
    })

    it('半价 - 50%', () => {
      expect(applyDiscount(1000, 3, 50)).toBe(1500)
    })

    it('单价为0', () => {
      expect(applyDiscount(0, 5, 80)).toBe(0)
    })

    it('数量为0', () => {
      expect(applyDiscount(1000, 0, 90)).toBe(0)
    })

    it('浮点精度验证', () => {
      // 9.99 * 3 * 95% → 需要正确四舍五入
      const result = applyDiscount(999, 3, 95)
      expect(result).toBe(Math.round(999 * 3 * 95 / 100))
    })
  })

  // ─── formatYuan ──────────────────────────────────────────
  describe('formatYuan', () => {
    it('基本转换', () => {
      expect(formatYuan(100)).toBe('1.00')
    })

    it('与 fenToYuan 行为一致', () => {
      const fen = 12345
      expect(formatYuan(fen)).toBe(fenToYuan(fen))
    })
  })

  // ─── formatDate ──────────────────────────────────────────
  describe('formatDate', () => {
    it('格式化时间戳', () => {
      // 2026-01-15 10:30:45 UTC+8 → ts
      const d = new Date(2026, 0, 15, 10, 30, 45) // month is 0-indexed
      const ts = d.getTime()
      expect(formatDate(ts)).toBe('2026-01-15 10:30:45')
    })

    it('补零', () => {
      const d = new Date(2026, 0, 5, 8, 5, 3)
      expect(formatDate(d.getTime())).toBe('2026-01-05 08:05:03')
    })
  })

  // ─── formatDateOnly ──────────────────────────────────────
  describe('formatDateOnly', () => {
    it('仅日期部分', () => {
      const d = new Date(2026, 5, 20, 15, 30, 0)
      expect(formatDateOnly(d.getTime())).toBe('2026-06-20')
    })
  })
})
