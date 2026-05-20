import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateMachineId,
  generateActivationCode,
  parseActivationExpiry,
  verifyActivationCode,
  getLicenseStatus,
  saveLicense,
  clearLicense,
  ensureFirstLaunch,
  type LicenseData,
} from '@/utils/license'

describe('license.ts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ─── parseActivationExpiry ───────────────────────────────
  describe('parseActivationExpiry', () => {
    it('解析正常日期', () => {
      expect(parseActivationExpiry('20261231-AAAA-BBBB-CCCC-DDDD')).toBe('2026-12-31')
    })

    it('解析永久授权 99999999', () => {
      expect(parseActivationExpiry('99999999-AAAA-BBBB-CCCC-DDDD')).toBe('permanent')
    })

    it('太短返回 null', () => {
      expect(parseActivationExpiry('123')).toBeNull()
    })

    it('日期格式非法返回 null', () => {
      expect(parseActivationExpiry('ABCDEFGH-AAAA-BBBB-CCCC-DDDD')).toBeNull()
    })

    it('月份超出范围返回 null', () => {
      expect(parseActivationExpiry('20261331-AAAA-BBBB-CCCC-DDDD')).toBeNull()
    })

    it('日期超出范围返回 null', () => {
      expect(parseActivationExpiry('20260132-AAAA-BBBB-CCCC-DDDD')).toBeNull()
    })

    it('年份过小返回 null', () => {
      expect(parseActivationExpiry('20190101-AAAA-BBBB-CCCC-DDDD')).toBeNull()
    })

    it('忽略大小写和空格', () => {
      expect(parseActivationExpiry('20260601-aaaa-bbbb-cccc-dddd')).toBe('2026-06-01')
    })
  })

  // ─── generateMachineId ───────────────────────────────────
  describe('generateMachineId', () => {
    it('生成格式 XXXX-XXXX-XXXX-XXXX', async () => {
      const id = await generateMachineId('test-host|4|AA:BB:CC:DD:EE:FF')
      expect(id).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    })

    it('相同指纹生成相同机器码', () => {
      const fp = 'my-host|8|11:22:33:44:55:66'
      return generateMachineId(fp).then(id1 =>
        generateMachineId(fp).then(id2 => expect(id1).toBe(id2))
      )
    })

    it('不同指纹生成不同机器码', () => {
      return Promise.all([
        generateMachineId('host-a|4|AA:BB:CC:DD:EE:FF'),
        generateMachineId('host-b|4|AA:BB:CC:DD:EE:FF'),
      ]).then(([id1, id2]) => expect(id1).not.toBe(id2))
    })
  })

  // ─── generateActivationCode + verifyActivationCode ───────
  describe('activation code generation & verification', () => {
    let machineId: string

    beforeEach(async () => {
      machineId = await generateMachineId('test-host|4|AA:BB:CC:DD:EE:FF')
    })

    it('生成有限期激活码并验证通过', async () => {
      const code = await generateActivationCode(machineId, '2026-12-31')
      expect(code).toMatch(/^\d{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      expect(await verifyActivationCode(machineId, code)).toBe(true)
    })

    it('生成永久激活码', async () => {
      const code = await generateActivationCode(machineId, 'permanent')
      expect(code).toMatch(/^99999999-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      expect(await verifyActivationCode(machineId, code)).toBe(true)
    })

    it('不同机器码验证失败', async () => {
      const code = await generateActivationCode(machineId, '2026-12-31')
      const otherMachineId = await generateMachineId('other-host|4|11:22:33:44:55:66')
      expect(await verifyActivationCode(otherMachineId, code)).toBe(false)
    })

    it('篡改激活码后验证失败', async () => {
      const code = await generateActivationCode(machineId, '2026-12-31')
      const tampered = code.slice(0, -1) + 'X'
      expect(await verifyActivationCode(machineId, tampered)).toBe(false)
    })

    it('空激活码验证失败', async () => {
      expect(await verifyActivationCode(machineId, '')).toBe(false)
    })

    it('格式错误的激活码验证失败', async () => {
      expect(await verifyActivationCode(machineId, 'INVALID')).toBe(false)
    })
  })

  // ─── getLicenseStatus ────────────────────────────────────
  describe('getLicenseStatus', () => {
    it('未激活且未设置首次启动 → 返回试用期', () => {
      const status = getLicenseStatus()
      expect(status.valid).toBe(false)
      expect((status as any).trial).toBe(true)
      // 30天试用期，时间精度可能导致29/30/31天
      expect((status as any).trialDaysLeft).toBeGreaterThanOrEqual(29)
      expect((status as any).trialDaysLeft).toBeLessThanOrEqual(31)
    })

    it('试用期剩余天数正确计算', () => {
      // 设置首次启动为 10 天前
      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
      tenDaysAgo.setHours(0, 0, 0, 0) // 精确到0点
      localStorage.setItem('retailpos_first_launch', tenDaysAgo.toISOString())

      const status = getLicenseStatus()
      expect(status.valid).toBe(false)
      expect((status as any).trial).toBe(true)
      expect((status as any).trialDaysLeft).toBeGreaterThanOrEqual(19)
      expect((status as any).trialDaysLeft).toBeLessThanOrEqual(21)
    })

    it('试用期结束后返回过期', () => {
      // 设置首次启动为 31 天前
      const longAgo = new Date()
      longAgo.setDate(longAgo.getDate() - 31)
      localStorage.setItem('retailpos_first_launch', longAgo.toISOString())

      const status = getLicenseStatus()
      expect(status.valid).toBe(false)
      expect((status as any).trial).toBe(false)
      expect((status as any).reason).toBe('试用期已结束')
    })

    it('已激活且在有效期内', () => {
      const future = new Date()
      future.setDate(future.getDate() + 30)
      const expiry = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`

      saveLicense({
        machineId: 'TEST-MACHINE-ID',
        expiryDate: expiry,
        activationCode: '20261231-AAAA-BBBB-CCCC-DDDD',
        activatedAt: new Date().toISOString(),
      })

      const status = getLicenseStatus()
      expect(status.valid).toBe(true)
      if (!status.valid) throw new Error('Expected valid')
      expect(status.license.expiryDate).toBe(expiry)
    })

    it('已激活但已过期', () => {
      saveLicense({
        machineId: 'TEST-MACHINE-ID',
        expiryDate: '2020-01-01',
        activationCode: '20200101-AAAA-BBBB-CCCC-DDDD',
        activatedAt: '2020-01-01T00:00:00.000Z',
      })

      const status = getLicenseStatus()
      expect(status.valid).toBe(false)
      expect((status as any).reason).toBe('授权已过期')
    })

    it('永久授权始终有效', () => {
      saveLicense({
        machineId: 'TEST-MACHINE-ID',
        expiryDate: 'permanent',
        activationCode: '99999999-AAAA-BBBB-CCCC-DDDD',
        activatedAt: new Date().toISOString(),
      })

      const status = getLicenseStatus()
      expect(status.valid).toBe(true)
      if (!status.valid) throw new Error('Expected valid')
      expect(status.daysLeft).toBeNull()
    })

    it('授权数据损坏返回错误', () => {
      localStorage.setItem('retailpos_license', 'not-json{{{')
      const status = getLicenseStatus()
      expect(status.valid).toBe(false)
      expect((status as any).reason).toBe('授权数据损坏')
    })
  })

  // ─── saveLicense / clearLicense ──────────────────────────
  describe('saveLicense / clearLicense', () => {
    it('保存后 getLicenseStatus 能读取', () => {
      const license: LicenseData = {
        machineId: 'AAAA-BBBB-CCCC-DDDD',
        expiryDate: '2099-12-31',
        activationCode: '20991231-XXXX-YYYY-ZZZZ-WWWW',
        activatedAt: new Date().toISOString(),
      }
      saveLicense(license)

      const status = getLicenseStatus()
      expect(status.valid).toBe(true)
    })

    it('清除后返回试用期', () => {
      const license: LicenseData = {
        machineId: 'AAAA-BBBB-CCCC-DDDD',
        expiryDate: '2099-12-31',
        activationCode: '20991231-XXXX-YYYY-ZZZZ-WWWW',
        activatedAt: new Date().toISOString(),
      }
      saveLicense(license)
      clearLicense()

      const status = getLicenseStatus()
      expect(status.valid).toBe(false)
      expect((status as any).trial).toBe(true)
    })
  })

  // ─── ensureFirstLaunch ───────────────────────────────────
  describe('ensureFirstLaunch', () => {
    it('首次调用设置首次启动日期', () => {
      ensureFirstLaunch()
      expect(localStorage.getItem('retailpos_first_launch')).toBeTruthy()
    })

    it('重复调用不覆盖', () => {
      ensureFirstLaunch()
      const first = localStorage.getItem('retailpos_first_launch')
      ensureFirstLaunch()
      const second = localStorage.getItem('retailpos_first_launch')
      expect(first).toBe(second)
    })
  })
})
