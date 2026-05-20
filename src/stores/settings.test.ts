import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始默认值', () => {
    const settings = useSettingsStore()
    expect(settings.shopName).toBe('我的门店')
    expect(settings.receiptFooter).toBe('谢谢惠顾，欢迎再来！')
    expect(settings.receiptShowBarcode).toBe(true)
    expect(settings.receiptPaperWidth).toBe('80')
    expect(settings.paymentMethods).toEqual([])
  })

  it('load 加载设置（从 DB）', async () => {
    const settings = useSettingsStore()
    await settings.load()

    // initDefaultData 已写入默认值
    expect(settings.shopName).toBe('我的门店')
    expect(settings.paymentMethods.length).toBeGreaterThan(0)
  })

  it('enabledPaymentMethods 过滤已启用', async () => {
    const settings = useSettingsStore()
    await settings.load()

    const enabled = settings.enabledPaymentMethods
    expect(enabled.length).toBeGreaterThan(0)
    enabled.forEach(m => expect(m.enabled).toBe(true))
  })

  it('saveSetting 保存并重新加载', async () => {
    const settings = useSettingsStore()
    await settings.load()

    await settings.saveSetting('shop.name', '新店名')
    expect(settings.shopName).toBe('新店名')
  })
})
