<template>
  <div class="page-products">
    <!-- 分类管理栏 -->
    <el-card class="category-bar" shadow="never">
      <div class="bar-row">
        <div class="cat-tabs">
          <el-tag
            :type="selectedCategoryId === 0 ? '' : 'info'"
            class="cat-tag"
            :class="{ active: selectedCategoryId === 0 }"
            @click="selectedCategoryId = 0"
          >全部</el-tag>
          <el-tag
            v-for="cat in categories"
            :key="cat.id"
            :type="selectedCategoryId === cat.id ? '' : 'info'"
            class="cat-tag"
            :class="{ active: selectedCategoryId === cat.id }"
            @click="selectedCategoryId = cat.id!"
          >{{ cat.name }}</el-tag>
          <el-button link size="small" @click="showCategoryDialog = true">
            <el-icon><Setting /></el-icon> 管理分类
          </el-button>
        </div>
        <div class="bar-actions">
          <el-input
            v-model="keyword"
            placeholder="搜索商品名称或条码"
            clearable
            prefix-icon="Search"
            style="width: 220px"
            @input="loadProducts"
          />
          <el-button type="primary" @click="openAddProduct">
            <el-icon><Plus /></el-icon> 新增商品
          </el-button>
          <el-button @click="handleImport">
            <el-icon><Upload /></el-icon> 导入
          </el-button>
          <el-button @click="handleExport">
            <el-icon><Download /></el-icon> 导出
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 商品表格 -->
    <el-card shadow="never" style="margin-top: 12px">
      <el-table
        v-loading="loading"
        :data="products"
        stripe
        size="default"
      >
        <el-table-column label="条码" prop="barcode" width="150" />
        <el-table-column label="商品名称" prop="name" min-width="160" />
        <el-table-column label="分类" width="100">
          <template #default="{ row }">
            {{ getCategoryName(row.categoryId) }}
          </template>
        </el-table-column>
        <el-table-column label="售价" width="100" align="right">
          <template #default="{ row }">
            <span class="price">{{ formatMoney(row.price) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="单位" prop="unit" width="70" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '正常' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditProduct(row)">编辑</el-button>
            <el-button
              link
              :type="row.isActive ? 'danger' : 'success'"
              size="small"
              @click="toggleProduct(row)"
            >{{ row.isActive ? '停用' : '启用' }}</el-button>
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
        @change="loadProducts"
      />
    </el-card>

    <!-- 新增/编辑商品弹窗 -->
    <el-dialog
      v-model="showProductDialog"
      :title="editingProduct?.id ? '编辑商品' : '新增商品'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入商品名称" />
        </el-form-item>
        <el-form-item label="条码" prop="barcode">
          <el-input v-model="form.barcode" placeholder="输入或扫码">
            <template #append>
              <el-button @click="genBarcode">自动生成</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="分类" prop="categoryId">
          <el-select v-model="form.categoryId" style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id!" />
          </el-select>
        </el-form-item>
        <el-form-item label="售价(元)" prop="priceYuan">
          <el-input-number v-model="form.priceYuan" :precision="2" :min="0" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="成本价(元)">
          <el-input-number v-model="form.costPriceYuan" :precision="2" :min="0" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="form.unit" style="width: 100%" allow-create filterable>
            <el-option label="个" value="个" />
            <el-option label="件" value="件" />
            <el-option label="斤" value="斤" />
            <el-option label="kg" value="kg" />
            <el-option label="瓶" value="瓶" />
            <el-option label="包" value="包" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showProductDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveProduct">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分类管理弹窗 -->
    <el-dialog v-model="showCategoryDialog" title="分类管理" width="400px">
      <div class="cat-list">
        <div v-for="cat in categories" :key="cat.id" class="cat-item">
          <span>{{ cat.name }}</span>
          <div>
            <el-button link size="small" @click="editCat(cat)">编辑</el-button>
            <el-button link type="danger" size="small" @click="deleteCat(cat.id!)">删除</el-button>
          </div>
        </div>
      </div>
      <el-divider />
      <el-input v-model="newCatName" placeholder="新分类名称" style="width: 200px; margin-right: 8px" />
      <el-button type="primary" @click="addCat">添加</el-button>
    </el-dialog>

    <!-- 导入商品弹窗 -->
    <el-dialog v-model="showImportDialog" title="批量导入商品" width="600px">
      <el-alert type="info" :closable="false" style="margin-bottom: 12px">
        请按模板格式准备 Excel 文件，必填列：商品名称、条码、售价（元）、分类
      </el-alert>
      <el-button style="margin-bottom: 12px" @click="downloadTemplate">下载导入模板</el-button>
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        accept=".xlsx,.xls"
        :limit="1"
        :on-change="handleFileChange"
      >
        <el-button type="primary">选择 Excel 文件</el-button>
      </el-upload>
      <div v-if="importPreview.length > 0" style="margin-top: 12px">
        <p style="font-size: 13px; color: #606266">预览（共 {{ importPreview.length }} 条）：</p>
        <el-table :data="importPreview.slice(0, 10)" size="small" max-height="200">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="barcode" label="条码" />
          <el-table-column prop="priceYuan" label="售价" />
          <el-table-column prop="category" label="分类" />
          <el-table-column label="状态">
            <template #default="{ row }">
              <el-tag :type="row._error ? 'danger' : 'success'" size="small">
                {{ row._error || '正常' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" :loading="importing" :disabled="importPreview.length === 0" @click="doImport">
          确认导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { Product, Category } from '@/types'
import {
  getProducts, getCategories, addProduct, updateProduct,
  generateBarcode, addCategory, updateCategory, deleteCategory,
  bulkAddProducts,
} from '@/db/products'
import { getCurrentInstance } from 'vue'

const instance = getCurrentInstance()
import { formatMoney } from '@/utils/money'
import { yuanToFen } from '@/utils/money'
import { exportToExcel, parseExcel } from '@/utils/excel'

const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const selectedCategoryId = ref(0)

const showProductDialog = ref(false)
const showCategoryDialog = ref(false)
const showImportDialog = ref(false)

const formRef = ref<FormInstance>()
const editingProduct = ref<Product | null>(null)
const form = ref({
  name: '', barcode: '', categoryId: 0,
  priceYuan: 0, costPriceYuan: 0, unit: '个', remark: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  barcode: [{ required: true, message: '请输入条码', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change', type: 'number', min: 1 }],
  priceYuan: [{ required: true, type: 'number', min: 0.01, message: '请输入正确售价', trigger: 'blur' }],
}

const newCatName = ref('')
const importPreview = ref<any[]>([])

function getCategoryName(id: number) {
  return categories.value.find((c) => c.id === id)?.name ?? '-'
}

async function loadCategories() {
  categories.value = await getCategories()
}

async function loadProducts() {
  loading.value = true
  try {
    const res = await getProducts({
      keyword: keyword.value,
      categoryId: selectedCategoryId.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    products.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function openAddProduct() {
  editingProduct.value = null
  form.value = { name: '', barcode: '', categoryId: categories.value[0]?.id ?? 0, priceYuan: 0, costPriceYuan: 0, unit: '个', remark: '' }
  showProductDialog.value = true
}

function openEditProduct(p: Product) {
  editingProduct.value = p
  form.value = {
    name: p.name, barcode: p.barcode, categoryId: p.categoryId,
    priceYuan: p.price / 100, costPriceYuan: (p.costPrice ?? 0) / 100,
    unit: p.unit, remark: p.remark ?? '',
  }
  showProductDialog.value = true
}

async function genBarcode() {
  form.value.barcode = await generateBarcode()
}

async function saveProduct() {
  const formComp = formRef.value ?? instance?.refs?.formRef as any
  await formComp?.validate()
  saving.value = true
  try {
    const data = {
      name: form.value.name,
      barcode: form.value.barcode,
      categoryId: form.value.categoryId,
      price: yuanToFen(form.value.priceYuan),
      costPrice: form.value.costPriceYuan ? yuanToFen(form.value.costPriceYuan) : undefined,
      unit: form.value.unit,
      remark: form.value.remark,
      isActive: true,
      updatedAt: Date.now(),
    }
    if (editingProduct.value?.id) {
      await updateProduct(editingProduct.value.id, data)
    } else {
      await addProduct({ ...data, createdAt: Date.now() })
    }
    ElMessage.success('保存成功')
    showProductDialog.value = false
    loadProducts()
  } finally {
    saving.value = false
  }
}

async function toggleProduct(p: Product) {
  await updateProduct(p.id!, { isActive: !p.isActive })
  loadProducts()
}

// 分类管理
async function addCat() {
  if (!newCatName.value.trim()) return
  await addCategory({ name: newCatName.value.trim(), sortOrder: categories.value.length + 1, createdAt: Date.now() })
  newCatName.value = ''
  loadCategories()
}

async function editCat(cat: Category) {
  const { value } = await ElMessageBox.prompt('修改分类名称', '编辑分类', { inputValue: cat.name })
  await updateCategory(cat.id!, { name: value })
  loadCategories()
}

async function deleteCat(id: number) {
  await ElMessageBox.confirm('确定删除该分类？', '确认')
  await deleteCategory(id)
  loadCategories()
}

// 导入导出
function handleImport() {
  importPreview.value = []
  showImportDialog.value = true
}

async function downloadTemplate() {
  await exportToExcel(
    [{ '商品名称': '示例商品', '条码': '6901234567890', '售价（元）': '9.90', '分类': '食品饮料', '单位': '个', '备注': '' }],
    '商品模板',
    '商品导入模板.xlsx'
  )
}

async function handleFileChange(file: any) {
  const rows = await parseExcel(file.raw)
  importPreview.value = rows.map((r: any) => ({
    name: r['商品名称'] ?? '',
    barcode: String(r['条码'] ?? ''),
    priceYuan: Number(r['售价（元）'] ?? 0),
    category: r['分类'] ?? '',
    unit: r['单位'] ?? '个',
    remark: r['备注'] ?? '',
    _error: !r['商品名称'] ? '缺少名称' : !r['条码'] ? '缺少条码' : !r['售价（元）'] ? '缺少售价' : '',
  }))
}

async function doImport() {
  const valid = importPreview.value.filter((r) => !r._error)
  if (valid.length === 0) { ElMessage.warning('没有可导入的有效数据'); return }
  importing.value = true
  try {
    const now = Date.now()
    const catMap = Object.fromEntries(categories.value.map((c) => [c.name, c.id!]))
    await bulkAddProducts(valid.map((r) => ({
      name: r.name,
      barcode: r.barcode,
      categoryId: catMap[r.category] ?? categories.value[0]?.id ?? 1,
      price: yuanToFen(r.priceYuan),
      unit: r.unit || '个',
      remark: r.remark,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })))
    ElMessage.success(`成功导入 ${valid.length} 条商品`)
    showImportDialog.value = false
    loadProducts()
  } finally {
    importing.value = false
  }
}

async function handleExport() {
  const all = await getProducts({ pageSize: 99999, page: 1 })
  const catMap = Object.fromEntries(categories.value.map((c) => [c.id!, c.name]))
  await exportToExcel(
    all.list.map((p) => ({
      '条码': p.barcode, '商品名称': p.name, '分类': catMap[p.categoryId] ?? '',
      '售价（元）': (p.price / 100).toFixed(2), '单位': p.unit,
      '状态': p.isActive ? '正常' : '已停用', '备注': p.remark ?? '',
    })),
    '商品列表',
    `商品列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`
  )
}

watch([selectedCategoryId, page, pageSize], loadProducts)

onMounted(async () => {
  await loadCategories()
  await loadProducts()
})
</script>

<style scoped>
.page-products { height: 100%; }
.category-bar { flex-shrink: 0; }
.bar-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.cat-tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cat-tag { cursor: pointer; user-select: none; }
.cat-tag.active { font-weight: 500; }
.bar-actions { display: flex; align-items: center; gap: 8px; }
.price { color: #e6a23c; font-weight: 500; }
.cat-list { max-height: 300px; overflow-y: auto; }
.cat-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
</style>
