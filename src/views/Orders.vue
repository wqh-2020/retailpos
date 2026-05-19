<template>
  <div class="page-orders">
    <!-- 筛选栏 -->
    <el-card shadow="never" style="margin-bottom: 12px">
      <div class="filter-row">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          style="width: 240px"
          @change="loadOrders"
        />
        <el-select v-model="filterStatus" placeholder="订单状态" clearable style="width: 120px" @change="loadOrders">
          <el-option label="已完成" value="completed" />
          <el-option label="已退款" value="refunded" />
          <el-option label="已作废" value="voided" />
        </el-select>
        <el-select v-model="filterPayment" placeholder="支付方式" clearable style="width: 130px" @change="loadOrders">
          <el-option v-for="m in methods" :key="m.code" :label="m.label" :value="m.code" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索订单号" clearable style="width: 180px" @input="loadOrders" />
        <el-button type="primary" plain @click="handleExport">
          <el-icon><Download /></el-icon> 导出Excel
        </el-button>
        <el-button plain @click="handleReset">重置筛选</el-button>
      </div>
    </el-card>

    <!-- 汇总统计条 -->
    <div class="summary-bar" v-if="summary.count > 0">
      <span>共 <strong>{{ summary.count }}</strong> 笔 &nbsp;&nbsp;</span>
      <span>实收合计：<strong class="amount">{{ formatMoney(summary.total) }}</strong></span>
      <span style="margin-left: 16px; color: #909399; font-size: 12px">（已退款/作废不计入）</span>
    </div>

    <!-- 订单表格 -->
    <el-card shadow="never">
      <el-table v-loading="loading" :data="orders" stripe row-key="id">
        <el-table-column label="订单号" prop="orderNo" width="170" />
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="商品数" width="70" align="center">
          <template #default="{ row }">{{ row._itemCount ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="实收金额" width="110" align="right">
          <template #default="{ row }">
            <span :class="['amount', row.status !== 'completed' && 'amount-void']">
              {{ formatMoney(row.actualAmount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" min-width="120">
          <template #default="{ row }">
            <el-tag v-for="tag in row._payTags" :key="tag" size="small" style="margin-right: 3px">{{ tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewOrder(row)">详情</el-button>
            <el-button link type="success" size="small" @click="reprintOrder(row)">补打</el-button>
            <el-button v-if="row.status === 'completed'" link type="warning" size="small" @click="doRefund(row)">退款</el-button>
            <el-button v-if="row.status === 'completed'" link type="danger" size="small" @click="doVoid(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 12px; justify-content: flex-end"
        @change="loadOrders"
      />
    </el-card>

    <!-- 订单详情弹窗 -->
    <el-dialog v-model="showDetail" title="订单详情" width="620px" :append-to-body="true">
      <div v-if="detailOrder">
        <div class="detail-header">
          <div>
            <span class="detail-order-no">{{ detailOrder.orderNo }}</span>
            <el-tag :type="statusType(detailOrder.status)" size="small" style="margin-left: 8px">
              {{ statusLabel(detailOrder.status) }}
            </el-tag>
          </div>
          <span class="detail-time">{{ formatTime(detailOrder.createdAt) }}</span>
        </div>
        <div v-if="detailOrder.remark" class="detail-remark">备注：{{ detailOrder.remark }}</div>
        <el-divider style="margin: 10px 0" />

        <!-- 商品明细 -->
        <el-table :data="detailItems" size="small" :show-header="true">
          <el-table-column label="商品名称" prop="productName" min-width="120" />
          <el-table-column label="条码" prop="barcode" width="120" />
          <el-table-column label="单价" width="90" align="right">
            <template #default="{ row }">{{ formatMoney(row.price) }}</template>
          </el-table-column>
          <el-table-column label="数量" prop="quantity" width="60" align="center" />
          <el-table-column label="折扣" width="70" align="center">
            <template #default="{ row }">
              <span v-if="row.discountRate < 100" style="color:#f56c6c">{{ row.discountRate }}折</span>
              <span v-else style="color:#c0c4cc">无</span>
            </template>
          </el-table-column>
          <el-table-column label="小计" width="90" align="right">
            <template #default="{ row }">{{ formatMoney(row.subtotal) }}</template>
          </el-table-column>
        </el-table>

        <el-divider style="margin: 10px 0" />

        <!-- 金额汇总 -->
        <div class="detail-totals">
          <div class="dt-row"><span>商品合计</span><span>{{ formatMoney(detailOrder.totalAmount) }}</span></div>
          <div v-if="detailOrder.discountAmount > 0" class="dt-row discount">
            <span>优惠减免</span><span>-{{ formatMoney(detailOrder.discountAmount) }}</span>
          </div>
          <div class="dt-row bold"><span>实收金额</span><span style="color: #e6a23c">{{ formatMoney(detailOrder.actualAmount) }}</span></div>
        </div>

        <el-divider style="margin: 10px 0" />

        <!-- 支付明细 -->
        <div class="detail-payments">
          <div class="dp-title">支付明细</div>
          <div v-for="p in detailPayments" :key="p.id" class="dp-row">
            <span>{{ getMethodLabel(p.paymentMethod) }}</span>
            <span :class="p.amount < 0 ? 'refund-amount' : ''">
              {{ p.amount < 0 ? '退款 -' : '' }}{{ formatMoney(Math.abs(p.amount)) }}
              <span v-if="p.changeAmount > 0" class="change-tip">（找零 {{ formatMoney(p.changeAmount) }}）</span>
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
        <el-button v-if="detailOrder" type="success" plain @click="reprintOrder(detailOrder!)">
          <el-icon><Printer /></el-icon> 补打小票
        </el-button>
        <el-button v-if="detailOrder?.status === 'completed'" type="warning" @click="doRefundFromDetail">退款</el-button>
        <el-button v-if="detailOrder?.status === 'completed'" type="danger" plain @click="doVoidFromDetail">作废</el-button>
      </template>
    </el-dialog>

    <!-- 隐藏的小票打印组件 -->
    <ReceiptPrint
      v-if="printOrder"
      ref="receiptRef"
      :order="printOrder"
      :items="printItems"
      :payments="printPayments"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Printer } from '@element-plus/icons-vue'
import type { Order, OrderItem, Payment, PaymentMethodCode } from '@/types'
import { queryOrders, getOrderItems, getOrderPayments, refundOrder, voidOrder, getSalesStats } from '@/db/orders'
import { useSettingsStore } from '@/stores/settings'
import { formatMoney } from '@/utils/money'
import { formatTime } from '@/utils/orderNo'
import { exportToExcel } from '@/utils/excel'
import ReceiptPrint from '@/components/cashier/ReceiptPrint.vue'

const settings = useSettingsStore()
const methods = settings.enabledPaymentMethods

const loading = ref(false)
const orders = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const dateRange = ref<[string, string] | null>(null)
const filterStatus = ref('')
const filterPayment = ref('')
const keyword = ref('')

const showDetail = ref(false)
const detailOrder = ref<Order | null>(null)
const detailItems = ref<OrderItem[]>([])
const detailPayments = ref<Payment[]>([])

// 补打小票相关
const printOrder = ref<Order | null>(null)
const printItems = ref<OrderItem[]>([])
const printPayments = ref<Payment[]>([])
const receiptRef = ref<InstanceType<typeof ReceiptPrint>>()

// 汇总统计
const summary = ref({ count: 0, total: 0 })

function statusLabel(s: string) {
  return { completed: '已完成', refunded: '已退款', voided: '已作废' }[s] ?? s
}
function statusType(s: string): 'success' | 'warning' | 'info' | '' {
  return ({ completed: 'success', refunded: 'warning', voided: 'info' } as any)[s] ?? ''
}
function getMethodLabel(code: PaymentMethodCode) {
  return settings.paymentMethods.find((m) => m.code === code)?.label ?? code
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await queryOrders({
      page: page.value,
      pageSize: pageSize.value,
      startDate: dateRange.value?.[0] ?? undefined,
      endDate: dateRange.value?.[1] ?? undefined,
      status: filterStatus.value as any || undefined,
      paymentMethod: filterPayment.value as any || undefined,
      keyword: keyword.value || undefined,
    })
    const enriched = await Promise.all(
      res.list.map(async (o) => {
        const pays = await getOrderPayments(o.id!)
        const items = await getOrderItems(o.id!)
        return {
          ...o,
          _payTags: [...new Set(pays.filter((p) => p.amount > 0).map((p) => getMethodLabel(p.paymentMethod)))],
          _itemCount: items.reduce((s, it) => s + it.quantity, 0),
        }
      })
    )
    orders.value = enriched
    total.value = res.total

    // 计算已完成订单汇总
    const completedOrders = enriched.filter((o) => o.status === 'completed')
    summary.value = {
      count: completedOrders.length,
      total: completedOrders.reduce((s, o) => s + o.actualAmount, 0),
    }
  } finally {
    loading.value = false
  }
}

function handleReset() {
  dateRange.value = null
  filterStatus.value = ''
  filterPayment.value = ''
  keyword.value = ''
  page.value = 1
  loadOrders()
}

async function viewOrder(row: Order) {
  detailOrder.value = row
  detailItems.value = await getOrderItems(row.id!)
  detailPayments.value = await getOrderPayments(row.id!)
  showDetail.value = true
}

async function doRefund(row: Order) {
  try {
    await ElMessageBox.confirm(`确定对订单 ${row.orderNo} 进行退款？此操作不可撤销。`, '退款确认', { type: 'warning' })
    await refundOrder(row.id!)
    ElMessage.success('退款成功')
    loadOrders()
  } catch { /* 取消 */ }
}

async function doVoid(row: Order) {
  try {
    await ElMessageBox.confirm(`确定作废订单 ${row.orderNo}？此操作不可撤销。`, '作废确认', { type: 'warning' })
    await voidOrder(row.id!)
    ElMessage.success('已作废')
    loadOrders()
  } catch { /* 取消 */ }
}

async function doRefundFromDetail() {
  if (!detailOrder.value) return
  showDetail.value = false
  await doRefund(detailOrder.value)
}

async function doVoidFromDetail() {
  if (!detailOrder.value) return
  showDetail.value = false
  await doVoid(detailOrder.value)
}

// 补打小票
async function reprintOrder(row: Order) {
  printOrder.value = row
  printItems.value = await getOrderItems(row.id!)
  printPayments.value = await getOrderPayments(row.id!)
  await nextTick()
  receiptRef.value?.openPreview()
}

async function handleExport() {
  const res = await queryOrders({
    page: 1,
    pageSize: 99999,
    startDate: dateRange.value?.[0],
    endDate: dateRange.value?.[1],
    status: filterStatus.value as any || undefined,
    paymentMethod: filterPayment.value as any || undefined,
    keyword: keyword.value || undefined,
  })

  // 获取支付明细
  const rows: Record<string, any>[] = []
  for (const o of res.list) {
    const pays = await getOrderPayments(o.id!)
    const items = await getOrderItems(o.id!)
    const payStr = [...new Set(pays.filter((p) => p.amount > 0).map((p) => getMethodLabel(p.paymentMethod)))].join('/')
    rows.push({
      '订单号': o.orderNo,
      '时间': formatTime(o.createdAt),
      '商品数量': items.reduce((s, it) => s + it.quantity, 0),
      '商品合计(元)': (o.totalAmount / 100).toFixed(2),
      '优惠(元)': (o.discountAmount / 100).toFixed(2),
      '实收(元)': (o.actualAmount / 100).toFixed(2),
      '支付方式': payStr,
      '状态': statusLabel(o.status),
      '备注': o.remark ?? '',
    })
  }
  await exportToExcel(rows, '流水明细', `流水明细_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`)
}

onMounted(loadOrders)
</script>

<style scoped>
.filter-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.summary-bar {
  padding: 8px 12px;
  background: #ecf5ff;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 10px;
  border: 1px solid #d9ecff;
}
.amount { color: #e6a23c; font-weight: 500; }
.amount-void { color: #c0c4cc; text-decoration: line-through; }

.detail-header { display: flex; justify-content: space-between; align-items: center; }
.detail-order-no { font-weight: 600; font-size: 14px; }
.detail-time { font-size: 12px; color: #909399; }
.detail-remark { font-size: 12px; color: #606266; margin-top: 4px; }

.detail-totals { padding: 0 4px; }
.dt-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
.dt-row.discount { color: #f56c6c; }
.dt-row.bold { font-weight: 600; font-size: 15px; padding-top: 4px; }

.detail-payments { padding: 0 4px; }
.dp-title { font-size: 12px; color: #909399; margin-bottom: 4px; }
.dp-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px; }
.refund-amount { color: #f56c6c; }
.change-tip { font-size: 11px; color: #909399; }
</style>
