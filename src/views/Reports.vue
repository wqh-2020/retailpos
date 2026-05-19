<template>
  <div class="page-reports">
    <!-- 时间范围切换 -->
    <el-card shadow="never" style="margin-bottom: 12px">
      <div class="toolbar">
        <el-radio-group v-model="range" @change="loadAll">
          <el-radio-button value="today">今日</el-radio-button>
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
        </el-radio-group>
        <el-divider direction="vertical" />
        <el-button plain size="small" @click="handleExport">
          <el-icon><Download /></el-icon> 导出报表
        </el-button>
      </div>
    </el-card>

    <!-- 核心指标卡 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">交易笔数</div>
        <div class="metric-value">{{ stats.count }}</div>
        <div class="metric-sub">笔</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">销售总额</div>
        <div class="metric-value amber">{{ fenToYuan(stats.total) }}</div>
        <div class="metric-sub">元</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">客单价</div>
        <div class="metric-value">{{ fenToYuan(stats.avgAmount) }}</div>
        <div class="metric-sub">元/单</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">商品种类</div>
        <div class="metric-value blue">{{ topProducts.length }}</div>
        <div class="metric-sub">种</div>
      </div>
    </div>

    <!-- 图表区域 -->
    <el-row :gutter="12" style="margin-top: 12px">
      <!-- 支付方式占比 -->
      <el-col :span="10">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>支付方式占比</span>
            </div>
          </template>
          <div v-if="!payData.length" class="empty-chart">
            <el-empty description="暂无数据" :image-size="60" />
          </div>
          <div v-else ref="payChartEl" class="chart-container" />
        </el-card>
      </el-col>

      <!-- 分类销售统计 -->
      <el-col :span="14">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>分类销售统计</span>
            </div>
          </template>
          <div v-if="!categoryStats.length" class="empty-chart">
            <el-empty description="暂无数据" :image-size="60" />
          </div>
          <div v-else ref="catChartEl" class="chart-container" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 每日销售趋势 -->
    <el-card shadow="never" style="margin-top: 12px" class="chart-card">
      <template #header>
        <div class="card-header">
          <span>销售趋势</span>
          <el-radio-group v-model="trendDays" size="small" @change="loadTrend">
            <el-radio-button :value="7">近7天</el-radio-button>
            <el-radio-button :value="14">近14天</el-radio-button>
            <el-radio-button :value="30">近30天</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <div v-if="!trendData.some((d) => d.count > 0)" class="empty-chart">
        <el-empty description="暂无数据" :image-size="60" />
      </div>
      <div v-else ref="trendChartEl" style="height: 220px" />
    </el-card>

    <!-- 商品销售排行 -->
    <el-card shadow="never" style="margin-top: 12px">
      <template #header>
        <div class="card-header">
          <span>商品销售排行 TOP 10</span>
        </div>
      </template>
      <div v-if="!topProducts.length" class="empty-table">
        <el-empty description="暂无销售数据" :image-size="60" />
      </div>
      <div v-else>
        <div class="rank-list">
          <div v-for="(item, idx) in topProducts" :key="item.productId" class="rank-item">
            <span :class="['rank-no', idx < 3 ? 'rank-top' : '']">{{ idx + 1 }}</span>
            <span class="rank-name">{{ item.productName }}</span>
            <div class="rank-bar-wrap">
              <div
                class="rank-bar"
                :style="{
                  width: topProducts[0].totalAmount ? (item.totalAmount / topProducts[0].totalAmount * 100) + '%' : '0%',
                  background: idx < 3 ? '#409eff' : '#a0cfff',
                }"
              />
            </div>
            <span class="rank-qty">× {{ item.totalQty }}</span>
            <span class="rank-amount">{{ fenToYuan(item.totalAmount) }}</span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getSalesStats, getPaymentStats } from '@/db/orders'
import { getTopProducts, getCategoryStats, getDailyTrend } from '@/db/reports'
import type { ProductStat, CategoryStat, DayStat } from '@/db/reports'
import { useSettingsStore } from '@/stores/settings'
import { fenToYuan } from '@/utils/money'
import { exportToExcel } from '@/utils/excel'

const settings = useSettingsStore()
const range = ref('today')
const trendDays = ref(7)

const stats = ref({ total: 0, count: 0, avgAmount: 0 })
const payData = ref<{ name: string; value: number }[]>([])
const topProducts = ref<ProductStat[]>([])
const categoryStats = ref<CategoryStat[]>([])
const trendData = ref<DayStat[]>([])

const payChartEl = ref<HTMLElement>()
const catChartEl = ref<HTMLElement>()
const trendChartEl = ref<HTMLElement>()
let payChart: ECharts | null = null
let catChart: ECharts | null = null
let trendChart: ECharts | null = null

function getTimeRange() {
  const now = new Date()
  if (range.value === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return { start, end: start + 86400000 - 1 }
  } else if (range.value === 'week') {
    const dow = now.getDay() || 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 1).getTime()
    return { start, end: Date.now() }
  } else {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return { start, end: Date.now() }
  }
}

async function loadAll() {
  const { start, end } = getTimeRange()

  // 核心指标
  stats.value = await getSalesStats(start, end)

  // 支付方式数据
  const rawPay = await getPaymentStats(start, end)
  payData.value = Object.entries(rawPay).map(([code, v]) => ({
    name: settings.paymentMethods.find((m) => m.code === code)?.label ?? code,
    value: v.amount,
  })).filter((d) => d.value > 0)

  // 商品排行
  topProducts.value = await getTopProducts(start, end, 10)

  // 分类统计
  categoryStats.value = await getCategoryStats(start, end)

  // 图表渲染
  await nextTick()
  renderPayChart()
  renderCatChart()

  // 趋势
  await loadTrend()
}

async function loadTrend() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTs = startOfToday - (trendDays.value - 1) * 86400000
  trendData.value = await getDailyTrend(startTs, trendDays.value)
  await nextTick()
  renderTrendChart()
}

function renderPayChart() {
  if (!payChartEl.value) return
  if (!payChart) payChart = echarts.init(payChartEl.value)
  payChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}<br/>¥${(p.value / 100).toFixed(2)}<br/>${p.percent}%`,
    },
    legend: { bottom: 4, type: 'scroll', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['30%', '58%'],
      center: ['50%', '44%'],
      data: payData.value,
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
      emphasis: { itemStyle: { shadowBlur: 10 } },
    }],
  })
}

function renderCatChart() {
  if (!catChartEl.value || !categoryStats.value.length) return
  if (!catChart) catChart = echarts.init(catChartEl.value)
  const cats = categoryStats.value.slice(0, 8)
  catChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}<br/>销售额：¥${(p.value / 100).toFixed(2)}`
      },
    },
    grid: { left: 12, right: 12, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => `¥${(v / 100).toFixed(0)}`, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: cats.map((c) => c.categoryName),
      axisLabel: { fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: cats.map((c) => c.totalAmount),
      itemStyle: { color: '#409eff', borderRadius: [0, 3, 3, 0] },
      label: {
        show: true,
        position: 'right',
        formatter: (p: any) => `¥${(p.value / 100).toFixed(0)}`,
        fontSize: 10,
        color: '#606266',
      },
    }],
  })
}

function renderTrendChart() {
  if (!trendChartEl.value) return
  if (!trendChart) trendChart = echarts.init(trendChartEl.value)
  const dates = trendData.value.map((d) => d.date.slice(5)) // MM-DD
  const amounts = trendData.value.map((d) => +(d.amount / 100).toFixed(2))
  const counts = trendData.value.map((d) => d.count)

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const a = params.find((p: any) => p.seriesName === '销售额')
        const c = params.find((p: any) => p.seriesName === '笔数')
        return `${params[0].axisValue}<br/>销售额：¥${a?.value ?? 0}<br/>笔数：${c?.value ?? 0}`
      },
    },
    legend: { top: 0, right: 0, data: ['销售额', '笔数'] },
    grid: { left: 12, right: 50, top: 30, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11, rotate: 30 } },
    yAxis: [
      { type: 'value', name: '元', axisLabel: { fontSize: 10, formatter: '¥{value}' } },
      { type: 'value', name: '笔', axisLabel: { fontSize: 10 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '销售额',
        type: 'bar',
        data: amounts,
        itemStyle: { color: '#409eff', borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 28,
      },
      {
        name: '笔数',
        type: 'line',
        yAxisIndex: 1,
        data: counts,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#e6a23c', width: 2 },
        itemStyle: { color: '#e6a23c' },
      },
    ],
  })
}

// 导出报表
async function handleExport() {
  if (!topProducts.value.length && !categoryStats.value.length) {
    ElMessage.warning('当前时段暂无数据')
    return
  }
  const rows = topProducts.value.map((p, i) => ({
    '排名': i + 1,
    '商品名称': p.productName,
    '条码': p.barcode,
    '销售数量': p.totalQty,
    '销售金额(元)': (p.totalAmount / 100).toFixed(2),
  }))
  await exportToExcel(rows, '商品销售排行', `销售报表_${range.value}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`)
}

onMounted(loadAll)
</script>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 8px; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 指标卡 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.metric-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 14px 16px;
  text-align: center;
}
.metric-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.metric-value { font-size: 28px; font-weight: 600; color: #303133; }
.metric-value.amber { color: #e6a23c; }
.metric-value.blue { color: #409eff; }
.metric-sub { font-size: 12px; color: #c0c4cc; margin-top: 2px; }

/* 图表 */
.chart-card { height: 100%; }
.chart-container { height: 260px; }
.empty-chart { height: 200px; display: flex; align-items: center; justify-content: center; }
.empty-table { padding: 20px 0; }

/* 商品排行 */
.rank-list { padding: 0 4px; }
.rank-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid #f5f7fa;
}
.rank-no {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #f0f2f5;
  color: #606266;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  line-height: 22px;
  flex-shrink: 0;
}
.rank-no.rank-top {
  background: #409eff;
  color: #fff;
}
.rank-name { width: 120px; font-size: 13px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-bar-wrap { flex: 1; height: 8px; background: #f0f2f5; border-radius: 4px; overflow: hidden; }
.rank-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
.rank-qty { width: 45px; font-size: 12px; color: #909399; text-align: right; flex-shrink: 0; }
.rank-amount { width: 80px; font-size: 13px; color: #e6a23c; font-weight: 500; text-align: right; flex-shrink: 0; }
</style>
