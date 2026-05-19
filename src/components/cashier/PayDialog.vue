<template>
  <el-dialog
    :model-value="modelValue"
    title="收款结算"
    width="520px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- 应收金额 -->
    <div class="pay-total">
      <span class="pay-total-label">应收金额</span>
      <span class="pay-total-amount">{{ formatMoney(total) }}</span>
    </div>

    <!-- 支付方式选择 -->
    <div class="pay-methods">
      <div
        v-for="m in enabledMethods"
        :key="m.code"
        class="method-item"
        :class="{ selected: selectedMethods.includes(m.code) }"
        @click="toggleMethod(m.code)"
      >
        <span class="method-dot" :style="{ background: m.color }" />
        {{ m.label }}
      </div>
    </div>

    <!-- 各支付方式金额输入 -->
    <div class="pay-inputs">
      <div v-for="m in activePayMethods" :key="m.code" class="pay-input-row">
        <span class="method-label">
          <span class="method-dot" :style="{ background: m.color }" />
          {{ m.label }}
        </span>
        <el-input-number
          v-model="payAmounts[m.code]"
          :precision="2"
          :min="0"
          :step="10"
          style="width: 150px"
          @change="onAmountChange"
        />
        <span class="yuan">元</span>
        <!-- 现金快捷金额 -->
        <div v-if="m.code === 'cash'" class="quick-amounts">
          <el-button
            v-for="v in quickAmounts"
            :key="v"
            size="small"
            @click="payAmounts['cash'] = v"
          >¥{{ v }}</el-button>
        </div>
        <!-- 找零显示 -->
        <span v-if="m.needChange && change > 0" class="change-hint">
          找零：{{ formatMoney(change) }}
        </span>
      </div>
    </div>

    <!-- 已支付 / 差额 -->
    <div class="pay-summary">
      <div class="summary-row">
        <span>已输入金额：</span>
        <span>{{ formatMoney(paidFen) }}</span>
      </div>
      <div v-if="diff > 0" class="summary-row warning">
        <span>仍需支付：</span>
        <span style="color: #f56c6c">{{ formatMoney(diff) }}</span>
      </div>
      <div v-if="diff < 0" class="summary-row">
        <span>找零：</span>
        <span style="color: #67c23a">{{ formatMoney(-diff) }}</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="diff > 0 || paidFen === 0" :loading="paying" @click="confirmPay">
        确认收款
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CartItem, PaymentMethodCode, Order, OrderItem, Payment } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { createOrder } from '@/db/orders'
import { formatMoney, yuanToFen } from '@/utils/money'
import { generateOrderNo } from '@/utils/orderNo'

const props = defineProps<{
  modelValue: boolean
  total: number        // 分
  cartItems: CartItem[]
  discountAmount: number
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'paid', payload: { order: Order; items: OrderItem[]; payments: Payment[] }): void
}>()

const settings = useSettingsStore()
const paying = ref(false)
const selectedMethods = ref<PaymentMethodCode[]>(['wechat'])
const payAmounts = ref<Record<string, number>>({ cash: 0, wechat: 0, alipay: 0, bankcard: 0, other: 0 })

const enabledMethods = computed(() => settings.enabledPaymentMethods)
const activePayMethods = computed(() =>
  enabledMethods.value.filter((m) => selectedMethods.value.includes(m.code))
)

const quickAmounts = computed(() => {
  const t = props.total / 100
  const base = [10, 20, 50, 100, 200, 500]
  return base.filter((v) => v >= t).slice(0, 4)
})

const paidFen = computed(() => {
  return activePayMethods.value.reduce((s, m) => {
    return s + yuanToFen(payAmounts.value[m.code] || 0)
  }, 0)
})

const diff = computed(() => props.total - paidFen.value)

// 找零（仅现金）
const change = computed(() => {
  if (!selectedMethods.value.includes('cash')) return 0
  const cashFen = yuanToFen(payAmounts.value.cash || 0)
  return Math.max(0, cashFen - props.total)
})

function toggleMethod(code: PaymentMethodCode) {
  if (selectedMethods.value.includes(code)) {
    selectedMethods.value = selectedMethods.value.filter((c) => c !== code)
    payAmounts.value[code] = 0
  } else {
    selectedMethods.value.push(code)
  }
}

function onAmountChange() {
  // 如果只有一种支付方式，自动补全剩余金额（现金类自动填满）
}

// 重置
watch(() => props.modelValue, (v) => {
  if (v) {
    selectedMethods.value = ['wechat']
    Object.keys(payAmounts.value).forEach((k) => (payAmounts.value[k] = 0))
    // 默认微信填满
    payAmounts.value.wechat = Math.ceil(props.total / 100)
  }
})

async function confirmPay() {
  if (diff.value > 0) { ElMessage.warning('收款金额不足'); return }
  paying.value = true
  try {
    const now = Date.now()
    const subtotal = props.cartItems.reduce((s, it) => s + it.product.price * it.quantity, 0)

    const orderData: Omit<Order, 'id'> = {
      orderNo: generateOrderNo(),
      status: 'completed',
      totalAmount: subtotal,
      discountAmount: props.discountAmount,
      actualAmount: props.total,
      createdAt: now,
      updatedAt: now,
    }

    const itemsData: Omit<OrderItem, 'id' | 'orderId'>[] = props.cartItems.map((it) => ({
      productId: it.product.id!,
      productName: it.product.name,
      barcode: it.product.barcode,
      price: it.product.price,
      quantity: it.quantity,
      discountRate: it.discountRate,
      subtotal: it.subtotal,
    }))

    const paymentsData: Omit<Payment, 'id' | 'orderId'>[] = activePayMethods.value.map((m) => {
      const amtFen = yuanToFen(payAmounts.value[m.code] || 0)
      return {
        paymentMethod: m.code,
        amount: amtFen,
        changeAmount: m.code === 'cash' ? Math.max(0, amtFen - props.total) : 0,
        createdAt: now,
      }
    })

    const orderId = await createOrder(orderData, itemsData, paymentsData)

    const fullOrder: Order = { ...orderData, id: orderId }
    const fullItems: OrderItem[] = itemsData.map((it, i) => ({ ...it, id: i, orderId }))
    const fullPayments: Payment[] = paymentsData.map((p, i) => ({ ...p, id: i, orderId }))

    emit('paid', { order: fullOrder, items: fullItems, payments: fullPayments })
    ElMessage.success('收款成功！')
  } catch (e: any) {
    ElMessage.error(e.message || '收款失败')
  } finally {
    paying.value = false
  }
}
</script>

<style scoped>
.pay-total {
  text-align: center;
  padding: 16px 0;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 16px;
}
.pay-total-label { font-size: 13px; color: #909399; display: block; margin-bottom: 4px; }
.pay-total-amount { font-size: 32px; font-weight: 500; color: #e6a23c; }
.pay-methods {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.method-item {
  padding: 7px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
}
.method-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}
.method-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.pay-inputs { margin-bottom: 12px; }
.pay-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.method-label {
  width: 80px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.yuan { font-size: 13px; color: #606266; }
.quick-amounts { display: flex; gap: 4px; }
.change-hint { font-size: 12px; color: #909399; }
.pay-summary { border-top: 1px solid #ebeef5; padding-top: 10px; }
.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}
.summary-row.warning { color: #f56c6c; }
</style>
