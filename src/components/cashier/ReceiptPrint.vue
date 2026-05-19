<template>
  <div class="receipt-wrapper" ref="receiptEl">
    <div class="receipt">
      <div class="receipt-header">
        <div class="shop-name">{{ settings.shopName }}</div>
        <div v-if="settings.shopPhone" class="shop-meta">电话：{{ settings.shopPhone }}</div>
        <div v-if="settings.shopAddress" class="shop-meta">地址：{{ settings.shopAddress }}</div>
        <div class="divider">────────────────────</div>
        <div class="meta-row">
          <span>单号：{{ order.orderNo }}</span>
        </div>
        <div class="meta-row">
          <span>时间：{{ formatTime(order.createdAt) }}</span>
        </div>
        <div class="divider">────────────────────</div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th class="name-col">商品</th>
            <th class="qty-col">数量</th>
            <th class="price-col">单价</th>
            <th class="subtotal-col">小计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.id">
            <td class="name-col">{{ it.productName }}</td>
            <td class="qty-col">{{ it.quantity }}</td>
            <td class="price-col">{{ fenToYuan(it.price) }}</td>
            <td class="subtotal-col">{{ fenToYuan(it.subtotal) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="divider">────────────────────</div>
      <div class="total-section">
        <div class="total-row">
          <span>商品合计</span>
          <span>{{ fenToYuan(order.totalAmount) }}</span>
        </div>
        <div v-if="order.discountAmount > 0" class="total-row">
          <span>优惠金额</span>
          <span>-{{ fenToYuan(order.discountAmount) }}</span>
        </div>
        <div class="total-row grand">
          <span>实收金额</span>
          <span>¥{{ fenToYuan(order.actualAmount) }}</span>
        </div>
      </div>
      <div class="divider">────────────────────</div>

      <div class="pay-section">
        <div v-for="p in payments.filter(x => x.amount > 0)" :key="p.id" class="pay-row">
          <span>{{ getMethodLabel(p.paymentMethod) }}</span>
          <span>¥{{ fenToYuan(p.amount) }}</span>
        </div>
        <div v-if="totalChange > 0" class="pay-row">
          <span>找零</span>
          <span>¥{{ fenToYuan(totalChange) }}</span>
        </div>
      </div>

      <div class="divider">────────────────────</div>
      <div class="receipt-footer">{{ settings.receiptFooter }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Order, OrderItem, Payment, PaymentMethodCode } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { fenToYuan } from '@/utils/money'
import { formatTime } from '@/utils/orderNo'

const props = defineProps<{
  order: Order
  items: OrderItem[]
  payments: Payment[]
}>()

const settings = useSettingsStore()
const receiptEl = ref<HTMLElement>()

const totalChange = computed(() =>
  props.payments.reduce((s, p) => s + p.changeAmount, 0)
)

const methodLabelMap: Record<PaymentMethodCode, string> = {
  cash: '现金', wechat: '微信支付', alipay: '支付宝', bankcard: '银行卡', other: '其他',
}

function getMethodLabel(code: PaymentMethodCode) {
  const m = settings.paymentMethods.find((x) => x.code === code)
  return m?.label ?? methodLabelMap[code] ?? code
}

async function print() {
  if ((window as any).electronAPI) {
    await (window as any).electronAPI.printReceipt()
  } else {
    window.print()
  }
}

defineExpose({ print })
</script>

<style scoped>
.receipt-wrapper {
  position: fixed;
  left: -9999px;
  top: 0;
}
.receipt {
  width: 80mm;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #000;
  padding: 8px;
}
.shop-name { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; }
.shop-meta { text-align: center; font-size: 11px; }
.divider { text-align: center; margin: 4px 0; }
.meta-row { font-size: 11px; }
.items-table { width: 100%; border-collapse: collapse; }
.items-table th, .items-table td { padding: 2px 0; font-size: 11px; }
.name-col { width: 45%; }
.qty-col { width: 15%; text-align: center; }
.price-col { width: 20%; text-align: right; }
.subtotal-col { width: 20%; text-align: right; }
.total-section { margin: 4px 0; }
.total-row { display: flex; justify-content: space-between; font-size: 12px; }
.total-row.grand { font-weight: bold; font-size: 14px; }
.pay-section { margin: 4px 0; }
.pay-row { display: flex; justify-content: space-between; font-size: 11px; }
.receipt-footer { text-align: center; font-size: 11px; margin-top: 6px; }

@media print {
  .receipt-wrapper { position: static; left: auto; }
}
</style>
