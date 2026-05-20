<template>
  <!-- 隐藏的小票（用于打印） -->
  <div class="receipt-hidden-zone" ref="receiptEl">
    <div class="receipt" id="receipt-print-area">
      <!-- 店铺头部 -->
      <div class="receipt-header">
        <div class="shop-name">{{ settings.shopName }}</div>
        <div v-if="settings.shopPhone" class="shop-meta">TEL: {{ settings.shopPhone }}</div>
        <div v-if="settings.shopAddress" class="shop-meta">{{ settings.shopAddress }}</div>
      </div>

      <div class="dashed-line" />

      <div class="meta-row"><span>单号</span><span>{{ order.orderNo }}</span></div>
      <div class="meta-row"><span>时间</span><span>{{ formatTime(order.createdAt) }}</span></div>

      <div class="dashed-line" />

      <!-- 商品明细 -->
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-name">商品名称</th>
            <th class="col-qty">数量</th>
            <th class="col-price">单价</th>
            <th class="col-sub">小计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.id ?? it.productId">
            <td class="col-name">
              {{ it.productName }}
              <span v-if="it.discountRate < 100" class="discount-badge">{{ it.discountRate }}折</span>
            </td>
            <td class="col-qty">{{ it.quantity }}</td>
            <td class="col-price">{{ fenToYuan(it.price) }}</td>
            <td class="col-sub">{{ fenToYuan(it.subtotal) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="dashed-line" />

      <!-- 合计 -->
      <div class="total-section">
        <div class="total-row">
          <span>商品合计</span>
          <span>{{ fenToYuan(order.totalAmount) }}</span>
        </div>
        <div v-if="order.discountAmount > 0" class="total-row discount-row">
          <span>优惠减免</span>
          <span>-{{ fenToYuan(order.discountAmount) }}</span>
        </div>
        <div class="total-row grand">
          <span>实 收</span>
          <span>¥{{ fenToYuan(order.actualAmount) }}</span>
        </div>
      </div>

      <div class="dashed-line" />

      <!-- 支付明细 -->
      <div class="pay-section">
        <div
          v-for="p in payments.filter((x) => x.amount > 0)"
          :key="p.id ?? p.paymentMethod"
          class="pay-row"
        >
          <span>{{ getMethodLabel(p.paymentMethod) }}</span>
          <span>¥{{ fenToYuan(p.amount) }}</span>
        </div>
        <div v-if="totalChange > 0" class="pay-row change-row">
          <span>找  零</span>
          <span>¥{{ fenToYuan(totalChange) }}</span>
        </div>
      </div>

      <div class="dashed-line" />

      <!-- 条码 -->
      <div v-if="settings.receiptShowBarcode" class="barcode-section">
        <div class="barcode-text">*{{ order.orderNo }}*</div>
      </div>

      <!-- 页脚 -->
      <div class="receipt-footer">{{ settings.receiptFooter || '谢谢惠顾，欢迎再来！' }}</div>
    </div>
  </div>

  <!-- 打印预览弹窗 -->
  <el-dialog
    v-model="showPreview"
    title="小票预览"
    width="340px"
    :append-to-body="true"
    class="receipt-preview-dialog"
  >
    <div class="receipt-preview-body">
      <!-- 预览内容（同上结构，显示版） -->
      <div class="receipt receipt-preview">
        <div class="receipt-header">
          <div class="shop-name">{{ settings.shopName }}</div>
          <div v-if="settings.shopPhone" class="shop-meta">TEL: {{ settings.shopPhone }}</div>
          <div v-if="settings.shopAddress" class="shop-meta">{{ settings.shopAddress }}</div>
        </div>
        <div class="dashed-line" />
        <div class="meta-row"><span>单号</span><span>{{ order.orderNo }}</span></div>
        <div class="meta-row"><span>时间</span><span>{{ formatTime(order.createdAt) }}</span></div>
        <div class="dashed-line" />
        <table class="items-table">
          <thead>
            <tr>
              <th class="col-name">商品名称</th>
              <th class="col-qty">数量</th>
              <th class="col-price">单价</th>
              <th class="col-sub">小计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.id ?? it.productId">
              <td class="col-name">
                {{ it.productName }}
                <span v-if="it.discountRate < 100" class="discount-badge">{{ it.discountRate }}折</span>
              </td>
              <td class="col-qty">{{ it.quantity }}</td>
              <td class="col-price">{{ fenToYuan(it.price) }}</td>
              <td class="col-sub">{{ fenToYuan(it.subtotal) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="dashed-line" />
        <div class="total-section">
          <div class="total-row">
            <span>商品合计</span><span>{{ fenToYuan(order.totalAmount) }}</span>
          </div>
          <div v-if="order.discountAmount > 0" class="total-row discount-row">
            <span>优惠减免</span><span>-{{ fenToYuan(order.discountAmount) }}</span>
          </div>
          <div class="total-row grand">
            <span>实 收</span><span>¥{{ fenToYuan(order.actualAmount) }}</span>
          </div>
        </div>
        <div class="dashed-line" />
        <div class="pay-section">
          <div v-for="p in payments.filter((x) => x.amount > 0)" :key="p.id ?? p.paymentMethod" class="pay-row">
            <span>{{ getMethodLabel(p.paymentMethod) }}</span>
            <span>¥{{ fenToYuan(p.amount) }}</span>
          </div>
          <div v-if="totalChange > 0" class="pay-row change-row">
            <span>找  零</span><span>¥{{ fenToYuan(totalChange) }}</span>
          </div>
        </div>
        <div class="dashed-line" />
        <div v-if="settings.receiptShowBarcode" class="barcode-section">
          <div class="barcode-text">*{{ order.orderNo }}*</div>
        </div>
        <div class="receipt-footer">{{ settings.receiptFooter || '谢谢惠顾，欢迎再来！' }}</div>
      </div>
    </div>
    <template #footer>
      <el-button @click="showPreview = false">关闭</el-button>
      <el-button type="primary" :loading="printing" @click="doPrint">
        <el-icon><Printer /></el-icon>打印小票
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer } from '@element-plus/icons-vue'
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
const showPreview = ref(false)
const printing = ref(false)

const totalChange = computed(() =>
  props.payments.reduce((s, p) => s + p.changeAmount, 0)
)

function getMethodLabel(code: PaymentMethodCode) {
  const m = settings.paymentMethods.find((x) => x.code === code)
  return m?.label ?? code
}

function fenToYuanStr(fen: number) {
  return (fen / 100).toFixed(2)
}

// 打开预览弹窗
function openPreview() {
  showPreview.value = true
}

// 执行打印
async function doPrint() {
  printing.value = true
  try {
    if ((window as any).electronAPI) {
      const res = await (window as any).electronAPI.printReceipt()
      if (res.ok) {
        ElMessage.success('打印成功')
        showPreview.value = false
      } else {
        ElMessage.warning('打印取消或失败')
      }
    } else {
      window.print()
      ElMessage.success('已发送打印')
      showPreview.value = false
    }
  } finally {
    printing.value = false
  }
}

// 直接打印（不弹预览）
async function print() {
  await doPrint()
}

defineExpose({ print, openPreview })
</script>

<style scoped>
/* ── 隐藏区域（仅打印时显现） ── */
.receipt-hidden-zone {
  position: fixed;
  left: -9999px;
  top: 0;
  pointer-events: none;
}

/* ── 通用小票样式 ── */
.receipt {
  width: 76mm;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 12px;
  color: #000;
  padding: 6px 8px;
  background: #fff;
}

.receipt-preview {
  width: 100%;
  font-size: 11px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.receipt-header { text-align: center; margin-bottom: 4px; }
.shop-name { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
.shop-meta { font-size: 10px; color: #333; }

.dashed-line {
  border: none;
  border-top: 1px dashed #999;
  margin: 5px 0;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin: 2px 0;
}

/* 商品表格 */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin: 3px 0;
}
.items-table th {
  font-size: 10px;
  padding: 1px 0;
  text-align: right;
  border-bottom: 1px solid #ccc;
}
.items-table td {
  font-size: 11px;
  padding: 2px 0;
  text-align: right;
  vertical-align: top;
}
.col-name { width: 44%; text-align: left !important; }
.col-qty  { width: 12%; }
.col-price { width: 22%; }
.col-sub  { width: 22%; }
.discount-badge {
  font-size: 9px;
  background: #f56c6c;
  color: #fff;
  padding: 0 2px;
  border-radius: 2px;
  margin-left: 2px;
}

/* 合计 */
.total-section { margin: 3px 0; }
.total-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin: 1px 0;
}
.total-row.discount-row { color: #f56c6c; }
.total-row.grand {
  font-weight: bold;
  font-size: 13px;
  margin-top: 3px;
}

/* 支付 */
.pay-section { margin: 3px 0; }
.pay-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin: 1px 0;
}
.change-row { color: #e6a23c; }

/* 条码 */
.barcode-section { text-align: center; margin: 4px 0; }
.barcode-text {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  letter-spacing: 2px;
}

/* 页脚 */
.receipt-footer {
  text-align: center;
  font-size: 10px;
  margin-top: 6px;
  color: #666;
}

/* 打印媒体查询 */
@media print {
  .receipt-hidden-zone {
    position: static;
    left: auto;
  }
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

/* 预览弹窗 */
.receipt-preview-body {
  max-height: 70vh;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  background: #f5f7fa;
  padding: 12px;
}
</style>
