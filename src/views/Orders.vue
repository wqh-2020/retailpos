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
        <el-button type="primary" @click="handleExport">
          <el-icon><Download /></el-icon> 导出
        </el-button>
      </div>
    </el-card>

    <!-- 订单表格 -->
    <el-card shadow="never">
      <el-table v-loading="loading" :data="orders" stripe>
        <el-table-column label="订单号" prop="orderNo" width="160" />
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="商品数" width="80" align="center">
          <template #default="{ row }">{{ row._itemCount ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="实收金额" width="110" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.actualAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" width="120">
          <template #default="{ row }">
            <el-tag v-for="tag in row._payTags" :key="tag" size="small" style="margin-right: 3px">{{ tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewOrder(row)">详情</el-button>
            <el-button v-if="row.status === 'completed'" link type="warning" size="small" @click="doRefund(row)">退款</el-button>
            <el-button v-if="row.status === 'completed'" link type="danger" size="small" @click="doVoid(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 12px; justify-content: flex-end"
        @change="loadOrders"
      />
    </el-card>

    <!-- 订单详情弹窗 -->
    <el-dialog v-model="showDetail" title="订单详情" width="600px">
      <div v-if="detailOrder">
        <div class="detail-header">
          <span>单号：{{ detailOrder.orderNo }}</span>
          <el-tag :type="statusType(detailOrder.status)" size="small">{{ statusLabel(detailOrder.status) }}</el-tag>
        </div>
        <div class="detail-time">时间：{{ formatTime(detailOrder.createdAt) }}</div>
        <el-divider />
        <el-table :data="detailItems" size="small">
          <el-table-column label="商品名称" prop="productName" />
          <el-table-column label="单价" width="90" align="right">
            <template #default="{ row }">{{ formatMoney(row.price) }}</template>
          </el-table-column>
          <el-table-column label="数量" prop="quantity" width="70" align="center" />
          <el-table-column label="小计" width="90" align="right">
            <template #default="{ row }">{{ formatMoney(row.subtotal) }}</template>
          </el-table-column>
        </el-table>
        <el-divider />
        <div class="detail-totals">
          <div class="dt-row"><span>商品合计</span><span>{{ formatMoney(detailOrder.totalAmount) }}</span></div>
          <div v-if="detailOrder.discountAmount > 0" class="dt-row">
            <span>优惠</span><span style="color: #67c23a">-{{ formatMoney(detailOrder.discountAmount) }}</span>
          </div>
          <div class="dt-row bold"><span>实收</span><span style="color: #e6a23c">{{ formatMoney(detailOrder.actualAmount) }}</span></div>
        </div>
        <el-divider />
        <div class="detail-payments">
          <div v-for="p in detailPayments" :key="p.id" class="dp-row">
            <span>{{ getMethodLabel(p.paymentMethod) }}</span>
            <span :style="p.amount < 0 ? 'color:#f56c6c' : ''">
              {{ p.amount < 0 ? '-' : '' }}{{ formatMoney(Math.abs(p.amount)) }}
              <span v-if="p.changeAmount > 0" style="color:#909399;font-size:12px">（找零 {{ formatMoney(p.changeAmount) }}）</span>
            </span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Order, OrderItem, Payment, PaymentMethodCode } from '@/types'
import { queryOrders, getOrderItems, getOrderPayments, refundOrder, voidOrder } from '@/db/orders'
import { useSettingsStore } from '@/stores/settings'
import { formatMoney } from '@/utils/money'
import { formatTime } from '@/utils/orderNo'
import { exportToExcel } from '@/utils/excel'

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

function statusLabel(s: string) {
  return { completed: '已完成', refunded: '已退款', voided: '已作废' }[s] ?? s
}
function statusType(s: string) {
  return { completed: 'success', refunded: 'warning', voided: 'info' }[s] ?? 'info'
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
    // 加载每笔订单的支付标签
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
  } finally {
    loading.value = false
  }
}

async function viewOrder(row: Order) {
  detailOrder.value = row
  detailItems.value = await getOrderItems(row.id!)
  detailPayments.value = await getOrderPayments(row.id!)
  showDetail.value = true
}

async function doRefund(row: Order) {
  await ElMessageBox.confirm(`确定对订单 ${row.orderNo} 进行退款？此操作不可撤销。`, '退款确认', { type: 'warning' })
  await refundOrder(row.id!)
  ElMessage.success('退款成功')
  loadOrders()
}

async function doVoid(row: Order) {
  await ElMessageBox.confirm(`确定作废订单 ${row.orderNo}？此操作不可撤销。`, '作废确认', { type: 'warning' })
  await voidOrder(row.id!)
  ElMessage.success('已作废')
  loadOrders()
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
  const rows = res.list.map((o) => ({
    '订单号': o.orderNo,
    '时间': formatTime(o.createdAt),
    '商品合计(元)': (o.totalAmount / 100).toFixed(2),
    '优惠(元)': (o.discountAmount / 100).toFixed(2),
    '实收(元)': (o.actualAmount / 100).toFixed(2),
    '状态': statusLabel(o.status),
  }))
  await exportToExcel(rows, '流水明细', `流水明细_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`)
}

onMounted(loadOrders)
</script>

<style scoped>
.filter-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.amount { color: #e6a23c; font-weight: 500; }
.detail-header { display: flex; justify-content: space-between; align-items: center; font-weight: 500; font-size: 14px; }
.detail-time { font-size: 12px; color: #909399; margin-top: 4px; }
.detail-totals { }
.dt-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
.dt-row.bold { font-weight: 500; font-size: 15px; }
.dp-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
</style>
