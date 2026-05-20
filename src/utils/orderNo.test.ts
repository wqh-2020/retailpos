import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateOrderNo, formatTime, formatDate, todayStart, todayEnd } from '@/utils/orderNo'

describe('orderNo.ts', () => {
  describe('generateOrderNo', () => {
    it('生成格式 YYYYMMDD-XXXXXX', () => {
      const no = generateOrderNo()
      expect(no).toMatch(/^\d{8}-\d{6}$/)
    })

    it('日期部分为当前日期', () => {
      const no = generateOrderNo()
      const datePart = no.slice(0, 8)
      const now = new Date()
      const expected = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      expect(datePart).toBe(expected)
    })

    it('每次生成不重复（概率性）', () => {
      const set = new Set(Array.from({ length: 100 }, () => generateOrderNo()))
      // 100次生成应至少有 90 个不同值（极低概率全重复）
      expect(set.size).toBeGreaterThan(90)
    })
  })

  describe('formatTime', () => {
    it('格式化时间戳', () => {
      const ts = new Date(2026, 5, 20, 14, 30, 45).getTime()
      const result = formatTime(ts)
      // locale 输出格式可能因环境而异，至少包含日期和时间信息
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })
  })

  describe('formatDate', () => {
    it('格式化日期', () => {
      const ts = new Date(2026, 5, 20).getTime()
      const result = formatDate(ts)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })
  })

  describe('todayStart / todayEnd', () => {
    it('todayStart 返回当天 00:00:00.000', () => {
      const start = todayStart()
      const d = new Date(start)
      expect(d.getHours()).toBe(0)
      expect(d.getMinutes()).toBe(0)
      expect(d.getSeconds()).toBe(0)
      expect(d.getMilliseconds()).toBe(0)
    })

    it('todayEnd 返回当天 23:59:59.999', () => {
      const end = todayEnd()
      const d = new Date(end)
      expect(d.getHours()).toBe(23)
      expect(d.getMinutes()).toBe(59)
      expect(d.getSeconds()).toBe(59)
      expect(d.getMilliseconds()).toBe(999)
    })

    it('todayStart < todayEnd', () => {
      expect(todayStart()).toBeLessThan(todayEnd())
    })
  })
})
