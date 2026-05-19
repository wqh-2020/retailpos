<template>
  <div class="page-reports">
    <!-- 时间范围选择 -->
    <el-card shadow="never" style="margin-bottom: 12px">
      <div style="display: flex; gap: 12px; align-items: center">
        <el-radio-group v-model="range" @change="loadStats">
          <el-radio-button value="today">今日</el-radio-button>
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
        </el-radio-group>
      </div>
    </el-card>

    <!-- 指标卡 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">交易笔数</div>
        <div class="metric-value">{{ stats.count }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">销售总额</div>
        <div class="metric-value amber">{{ formatMoney(stats.total) }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">客单价</div>
        <div class="metric-value">{{ formatMoney(stats.avgAmount) }}</div>
      </div>
    </div>

    <!-- 支付方式占比 -->
    <el-card shadow="never" style="margin-top: 12px">
      <template #header>支付方式占比</template>
      <div ref="payChartEl" style="height: 260px" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { getSalesStats, getPaymentStats } from '@/db/orders'
import { useSettingsStore } from '@/stores/settings'
import { formatMoney } from '@/utils/money'
import { todayStart, todayEnd } from '@/utils/orderNo'

const settings = useSettingsStore()
const range = ref('today')
const stats = ref({ total: 0, count: 0, avgAmount: 0 })
const payChartEl = ref<HTMLElement>()
let payChart: ECharts | null = null

function getRange() {
  const now = new Date()
  if (range.value === 'today') {
    return { start: todayStart(), end: todayEnd() }
  } else if (range.value === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay() + 1)
    d.setHours(0, 0, 0, 0)
    return { start: d.getTime(), end: todayEnd() }
  } else {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: d.getTime(), end: todayEnd() }
  }
}

async function loadStats() {
  const { start, end } = getRange()
  stats.value = await getSalesStats(start, end)
  const payStats = await getPaymentStats(start, end)

  const data = Object.entries(payStats).map(([code, v]) => {
    const label = settings.paymentMethods.find((m) => m.code === code)?.label ?? code
    return { name: label, value: v.amount }
  })

  await nextTick()
  if (!payChart && payChartEl.value) {
    payChart = echarts.init(payChartEl.value)
  }
  payChart?.setOption({
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>¥${(p.value / 100).toFixed(2)} (${p.percent}%)` },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['35%', '60%'], center: ['50%', '45%'],
      data: data.length ? data : [{ name: '暂无数据', value: 1 }],
      label: { show: true, formatter: '{b}: {d}%' },
    }],
  })
}

onMounted(loadStats)
watch(range, loadStats)
</script>

<style scoped>
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.metric-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
}
.metric-label { font-size: 13px; color: #909399; margin-bottom: 6px; }
.metric-value { font-size: 26px; font-weight: 500; color: #303133; }
.metric-value.amber { color: #e6a23c; }
</style>
