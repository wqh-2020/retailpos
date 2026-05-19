import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, initDefaultData } from '@/db'
import type { PaymentMethod } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  const shopName = ref('我的门店')
  const shopPhone = ref('')
  const shopAddress = ref('')
  const shopLogo = ref('')       // data URL 存储
  const receiptFooter = ref('谢谢惠顾，欢迎再来！')
  const receiptShowBarcode = ref(true)
  const receiptPaperWidth = ref('80')
  const paymentMethods = ref<PaymentMethod[]>([])

  async function load() {
    await initDefaultData()

    const rows = await db.settings.toArray()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

    shopName.value = map['shop.name'] ?? '我的门店'
    shopPhone.value = map['shop.phone'] ?? ''
    shopAddress.value = map['shop.address'] ?? ''
    shopLogo.value = map['shop.logo'] ?? ''
    receiptFooter.value = map['receipt.footer'] ?? '谢谢惠顾，欢迎再来！'
    receiptShowBarcode.value = map['receipt.showBarcode'] !== 'false'
    receiptPaperWidth.value = map['receipt.paperWidth'] ?? '80'
    paymentMethods.value = JSON.parse(map['payment.methods'] ?? '[]')
  }

  async function saveSetting(key: string, value: string) {
    await db.settings.put({ key, value, updatedAt: Date.now() })
    await load()
  }

  const enabledPaymentMethods = computed(() =>
    paymentMethods.value.filter((m) => m.enabled)
  )

  return {
    shopName, shopPhone, shopAddress, shopLogo,
    receiptFooter, receiptShowBarcode, receiptPaperWidth,
    paymentMethods, enabledPaymentMethods,
    load, saveSetting,
  }
})
