<template>
  <div class="page">
    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab">
      <!-- 库存查询 -->
      <el-tab-pane label="库存查询" name="list">
        <div class="toolbar">
          <el-input v-model="keyword" placeholder="商品名称/条码" clearable style="width:220px" @change="load">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filterCategory" placeholder="全部分类" clearable style="width:160px" @change="load">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-checkbox v-model="lowStockOnly" @change="load">仅显示低库存</el-checkbox>
          <el-button type="primary" @click="openStockIn">
            <el-icon><Plus /></el-icon> 采购入库
          </el-button>
        </div>

        <!-- 预警卡片 -->
        <div class="alert-cards" v-if="lowStockProducts.length > 0">
          <div class="alert-card" v-for="p in lowStockProducts.slice(0, 6)" :key="p.id">
            <div class="alert-name">{{ p.name }}</div>
            <div class="alert-stock">
              <span class="stock-num" :class="{ low: p.stock <= (p.lowStockThreshold ?? 10) }">{{ p.stock }}</span>
              <span class="stock-unit">{{ p.unit }}</span>
            </div>
            <div class="alert-threshold">预警值：{{ p.lowStockThreshold ?? 10 }}</div>
          </div>
        </div>

        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="barcode" label="条码" width="130" />
          <el-table-column prop="name" label="商品名称" min-width="180" />
          <el-table-column prop="categoryId" label="分类" width="120">
            <template #default="{ row }">
              {{ getCatName(row.categoryId) }}
            </template>
          </el-table-column>
          <el-table-column label="库存" width="100">
            <template #default="{ row }">
              <span :class="{ 'stock-low': row.stock <= (row.lowStockThreshold ?? 10) }">
                {{ row.stock ?? 0 }}
              </span>
              {{ row.unit }}
            </template>
          </el-table-column>
          <el-table-column label="预警阈值" width="100">
            <template #default="{ row }">
              {{ row.lowStockThreshold ?? 10 }} {{ row.unit }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="(row.stock ?? 0) <= (row.lowStockThreshold ?? 10)" type="danger" size="small">低库存</el-tag>
              <el-tag v-else type="success" size="small">正常</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="售价">
            <template #default="{ row }">
              {{ formatMoney(row.price) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="200">
            <template #default="{ row }">
              <el-button size="small" type="primary" plain @click="openAdjust(row)">调整</el-button>
              <el-button size="small" @click="openSetThreshold(row)">阈值</el-button>
              <el-button size="small" @click="openRecords(row)">明细</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="page"
          :page-size="20"
          :total="total"
          layout="total, prev, pager, next"
          style="margin-top:12px"
        />
      </el-tab-pane>

      <!-- 库存记录 -->
      <el-tab-pane label="库存记录" name="records">
        <div class="toolbar">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="~" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:260px" @change="loadRecords" />
          <el-select v-model="recordType" placeholder="操作类型" clearable style="width:140px" @change="loadRecords">
            <el-option v-for="t in OP_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <el-input v-model="recordKeyword" placeholder="商品名称" clearable style="width:180px" @change="loadRecords" />
        </div>

        <el-table :data="recordList" v-loading="loadingRecords" stripe>
          <el-table-column label="时间" width="170">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="opTagType(row.type)" size="small">{{ opLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="productName" label="商品" min-width="160" />
          <el-table-column prop="barcode" label="条码" width="130" />
          <el-table-column label="数量变化" width="110">
            <template #default="{ row }">
              <span :class="row.quantity >= 0 ? 'stock-in' : 'stock-out'">
                {{ row.quantity >= 0 ? '+' : '' }}{{ row.quantity }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作后库存" width="110">
            <template #default="{ row }">{{ row.stockAfter }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="140" />
        </el-table>

        <el-pagination
          v-model:current-page="recordPage"
          :page-size="20"
          :total="recordTotal"
          layout="total, prev, pager, next"
          style="margin-top:12px"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 采购入库弹窗 -->
    <el-dialog v-model="stockInVisible" title="采购入库" width="520px">
      <el-form :model="stockInForm" label-width="90px">
        <el-form-item label="商品">
          <el-select v-model="stockInForm.productId" placeholder="选择商品" filterable style="width:100%" @change="onProductChange">
            <el-option v-for="p in productOptions" :key="p.id" :label="p.name + '（' + p.barcode + '）'" :value="p.id!" />
          </el-select>
        </el-form-item>
        <el-form-item label="入库数量">
          <el-input-number v-model="stockInForm.quantity" :min="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stockInForm.remark" placeholder="如：第3批采购" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockInVisible = false">取消</el-button>
        <el-button type="primary" @click="handleStockIn" :loading="saving">确认入库</el-button>
      </template>
    </el-dialog>

    <!-- 库存调整弹窗 -->
    <el-dialog v-model="adjustVisible" title="库存调整" width="520px">
      <el-form :model="adjustForm" label-width="90px">
        <el-form-item label="商品">
          <span>{{ adjustForm.productName }}</span>
        </el-form-item>
        <el-form-item label="当前库存">
          <span>{{ adjustForm.stockCurrent }} {{ adjustForm.unit }}</span>
        </el-form-item>
        <el-form-item label="调整数量">
          <el-input-number v-model="adjustForm.quantity" :min="-adjustForm.stockCurrent" style="width:100%" />
          <div class="form-tip">正数=增加，负数=减少（最多减至0）</div>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="adjustForm.remark" placeholder="调整原因，如：盘点盘盈" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdjust" :loading="saving">确认调整</el-button>
      </template>
    </el-dialog>

    <!-- 设置预警阈值弹窗 -->
    <el-dialog v-model="thresholdVisible" title="库存预警阈值" width="440px">
      <el-form :model="thresholdForm" label-width="100px">
        <el-form-item label="商品">
          <span>{{ thresholdForm.productName }}</span>
        </el-form-item>
        <el-form-item label="当前阈值">
          {{ thresholdForm.threshold }} {{ thresholdForm.unit }}
        </el-form-item>
        <el-form-item label="新阈值">
          <el-input-number v-model="thresholdForm.threshold" :min="0" style="width:100%" />
          <div class="form-tip">库存 ≤ 此值时触发低库存预警</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="thresholdVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSetThreshold" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 库存明细弹窗 -->
    <el-dialog v-model="recordsVisible" :title="'库存明细 - ' + recordsProductName" width="700px">
      <el-table :data="productRecordList" stripe max-height="400">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="opTagType(row.type)" size="small">{{ opLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="90">
          <template #default="{ row }">
            <span :class="row.quantity >= 0 ? 'stock-in' : 'stock-out'">
              {{ row.quantity >= 0 ? '+' : '' }}{{ row.quantity }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="90">{{ '{' + 'stockAfter' + '}' }}</el-table-column>
        <el-table-column prop="remark" label="备注" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getCategories } from '@/db/products'
import { getStockList, getLowStockProducts, addStockRecord, getStockRecords, updateProductStockSetting } from '@/db/inventory'
import { getProducts } from '@/db/products'
import type { Category, Product, StockRecord, StockOpType, StockProduct } from '@/types'
import { formatMoney } from '@/utils/money'

const activeTab = ref('list')
const keyword = ref('')
const filterCategory = ref<number | ''>('')
const lowStockOnly = ref(false)
const list = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const categories = ref<Category[]>([])
const productOptions = ref<Product[]>([])
const lowStockProducts = ref<StockProduct[]>([])

// 入库
const stockInVisible = ref(false)
const stockInForm = reactive({ productId: '' as any, quantity: 1, remark: '' })
const saving = ref(false)

function openStockIn() {
  Object.assign(stockInForm, { productId: '', quantity: 1, remark: '' })
  stockInVisible.value = true
}
function onProductChange() {}
async function handleStockIn() {
  if (!stockInForm.productId) { ElMessage.warning('请选择商品'); return }
  saving.value = true
  try {
    await addStockRecord(stockInForm.productId, 'purchase', stockInForm.quantity, stockInForm.remark)
    ElMessage.success('入库成功')
    stockInVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

// 调整
const adjustVisible = ref(false)
const adjustForm = reactive({ productId: 0, productName: '', stockCurrent: 0, quantity: 0, remark: '', unit: '' })
function openAdjust(row: any) {
  Object.assign(adjustForm, { productId: row.id, productName: row.name, stockCurrent: row.stock ?? 0, quantity: 0, remark: '', unit: row.unit })
  adjustVisible.value = true
}
async function handleAdjust() {
  if (adjustForm.quantity === 0) { ElMessage.warning('调整数量不能为0'); return }
  saving.value = true
  try {
    const type: StockOpType = adjustForm.quantity > 0 ? 'adjust_add' : 'adjust_minus'
    await addStockRecord(adjustForm.productId, type, adjustForm.quantity, adjustForm.remark)
    ElMessage.success('调整成功')
    adjustVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

// 阈值
const thresholdVisible = ref(false)
const thresholdForm = reactive({ productId: 0, productName: '', threshold: 10, unit: '' })
function openSetThreshold(row: any) {
  Object.assign(thresholdForm, { productId: row.id, productName: row.name, threshold: row.lowStockThreshold ?? 10, unit: row.unit })
  thresholdVisible.value = true
}
async function handleSetThreshold() {
  saving.value = true
  try {
    const p = productOptions.value.find(p => p.id === thresholdForm.productId)
    await updateProductStockSetting(thresholdForm.productId, p?.stock ?? 0, thresholdForm.threshold)
    ElMessage.success('阈值已更新')
    thresholdVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

// 库存明细
const recordsVisible = ref(false)
const recordsProductName = ref('')
const productRecordList = ref<StockRecord[]>([])
async function openRecords(row: any) {
  recordsProductName.value = row.name
  const r = await getStockRecords({ productId: row.id, pageSize: 100 })
  productRecordList.value = r.list
  recordsVisible.value = true
}

// 库存记录
const dateRange = ref<[string, string] | null>(null)
const recordType = ref<StockOpType | ''>('')
const recordKeyword = ref('')
const recordList = ref<StockRecord[]>([])
const loadingRecords = ref(false)
const recordTotal = ref(0)
const recordPage = ref(1)

const OP_TYPES = [
  { value: 'purchase',     label: '采购入库' },
  { value: 'adjust_add',   label: '盘盈' },
  { value: 'adjust_minus', label: '盘亏' },
  { value: 'sale',         label: '销售出库' },
  { value: 'return',       label: '退货入库' },
  { value: 'void',         label: '订单作废' },
]

function opLabel(type: StockOpType): string {
  return OP_TYPES.find(t => t.value === type)?.label ?? type
}
function opTagType(type: StockOpType): string {
  const map: Record<string, string> = {
    purchase: 'success', adjust_add: 'success', return: 'success',
    sale: 'warning', adjust_minus: 'danger', void: 'info',
  }
  return map[type] ?? 'info'
}
function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function load() {
  loading.value = true
  try {
    const res = await getStockList({
      keyword: keyword.value || undefined,
      categoryId: filterCategory.value || undefined,
      lowStockOnly: lowStockOnly.value,
      page: page.value,
      pageSize: 20,
    })
    list.value = res.list
    total.value = res.total
    lowStockProducts.value = await getLowStockProducts()
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  loadingRecords.value = true
  try {
    const res = await getStockRecords({
      type: recordType.value || undefined,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      page: recordPage.value,
      pageSize: 20,
    })
    let arr = res.list
    if (recordKeyword.value) {
      arr = arr.filter(r => r.productName.toLowerCase().includes(recordKeyword.value.toLowerCase()))
    }
    recordList.value = arr
    recordTotal.value = arr.length
  } finally {
    loadingRecords.value = false
  }
}

function getCatName(id: number): string {
  return categories.value.find(c => c.id === id)?.name ?? '-'
}

onMounted(async () => {
  categories.value = await getCategories()
  const r = await getProducts({ isActive: true, pageSize: 1000 })
  productOptions.value = r.list
  await load()
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; gap: 10px; align-items: center; }
.alert-cards { display: flex; gap: 10px; flex-wrap: wrap; }
.alert-card { background: #fff; border-radius: 8px; padding: 10px 14px; min-width: 120px; border-left: 3px solid #F56C6C; }
.alert-name { font-size: 13px; color: #303133; margin-bottom: 4px; }
.alert-stock { display: flex; align-items: baseline; gap: 2px; }
.stock-num { font-size: 22px; font-weight: 600; color: #303133; }
.stock-num.low { color: #F56C6C; }
.stock-low { color: #F56C6C; font-weight: 600; }
.stock-unit { font-size: 12px; color: #909399; }
.alert-threshold { font-size: 11px; color: #909399; margin-top: 2px; }
.stock-in { color: #67C23A; font-weight: 500; }
.stock-out { color: #F56C6C; font-weight: 500; }
.form-tip { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
