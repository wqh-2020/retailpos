<template>
  <div class="cashier-layout">
    <!-- 左：商品搜索区 -->
    <div class="search-panel">
      <el-card shadow="never" class="search-card">
        <div class="search-row">
          <el-input
            ref="searchInputRef"
            v-model="searchKeyword"
            placeholder="扫码或输入商品名称（F1 聚焦）"
            clearable
            size="large"
            prefix-icon="Search"
            @keyup.enter="handleEnterSearch"
            @input="handleSearchInput"
          />
          <!-- 挂单按钮 -->
          <el-badge :value="cartStore.heldOrders.length || undefined" type="warning">
            <el-button @click="showHeldOrders = true">
              <el-icon><DocumentCopy /></el-icon> 挂单
            </el-button>
          </el-badge>
        </div>

        <!-- 搜索结果下拉 -->
        <div v-if="searchResults.length > 0" class="search-results">
          <div
            v-for="p in searchResults"
            :key="p.id"
            class="result-item"
            @click="addToCart(p)"
          >
            <div class="result-name">{{ p.name }}</div>
            <div class="result-meta">
              <span class="result-barcode">{{ p.barcode }}</span>
              <span class="result-price">{{ formatMoney(p.price) }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 常用分类快捷商品（可选展示） -->
      <el-card shadow="never" style="margin-top: 10px; flex: 1; overflow-y: auto">
        <template #header>
          <div style="font-size: 13px; color: #909399">快捷商品（点击分类过滤）</div>
        </template>
        <div class="quick-cat-tabs">
          <el-tag
            v-for="cat in categories"
            :key="cat.id"
            :type="quickCatId === cat.id ? '' : 'info'"
            class="cat-tag"
            @click="quickCatId = cat.id!"
          >{{ cat.name }}</el-tag>
        </div>
        <div class="quick-products">
          <div
            v-for="p in quickProducts"
            :key="p.id"
            class="quick-item"
            @click="addToCart(p)"
          >
            <div class="qi-name">{{ p.name }}</div>
            <div class="qi-price">{{ formatMoney(p.price) }}</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 右：购物车 -->
    <div class="cart-panel">
      <el-card shadow="never" class="cart-card">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-weight: 500">购物车</span>
            <el-button link type="danger" size="small" :disabled="cartStore.items.length === 0" @click="cartStore.clearCart()">
              清空
            </el-button>
          </div>
        </template>

        <div class="cart-items">
          <div v-if="cartStore.items.length === 0" class="cart-empty">
            <el-empty description="购物车为空，扫码添加商品" :image-size="80" />
          </div>
          <el-table v-else :data="cartStore.items" size="small" :show-header="true">
            <el-table-column label="商品" min-width="120">
              <template #default="{ row }">
                <div class="cart-name">{{ row.product.name }}</div>
              </template>
            </el-table-column>
            <el-table-column label="单价" width="80" align="right">
              <template #default="{ row }">
                <span style="color: #606266; font-size: 12px">{{ formatMoney(row.product.price) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="110">
              <template #default="{ row }">
                <el-input-number
                  :model-value="row.quantity"
                  :min="1"
                  :max="9999"
                  size="small"
                  controls-position="right"
                  @change="(v: number | undefined) => cartStore.updateQuantity(row.product.id!, v || 1)"
                />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="90" align="right">
              <template #default="{ row }">
                <span class="cart-subtotal">{{ formatMoney(row.subtotal) }}</span>
              </template>
            </el-table-column>
            <el-table-column width="40" fixed="right">
              <template #default="{ row }">
                <el-button link type="danger" size="small" @click="cartStore.removeItem(row.product.id!)">
                  <el-icon><Close /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 合计区 -->
        <div class="cart-footer">
          <div class="total-row">
            <span>小计</span>
            <span>{{ formatMoney(cartStore.subtotal) }}</span>
          </div>
          <div class="total-row discount-row">
            <span>整单折扣</span>
            <el-input-number
              v-model="cartStore.wholeDiscount"
              :min="1"
              :max="100"
              :step="1"
              size="small"
              style="width: 90px"
            />
            <span>%</span>
            <span v-if="cartStore.discountAmount > 0" style="color: #f56c6c">
              -{{ formatMoney(cartStore.discountAmount) }}
            </span>
          </div>
          <div class="total-row grand-total">
            <span>合计</span>
            <span class="grand-amount">{{ formatMoney(cartStore.total) }}</span>
          </div>
          <el-button
            type="primary"
            size="large"
            style="width: 100%; margin-top: 12px; font-size: 16px; height: 48px"
            :disabled="cartStore.items.length === 0"
            @click="showPayDialog = true"
          >
            结算（F2）
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 结算弹窗 -->
    <PayDialog
      v-model="showPayDialog"
      :total="cartStore.total"
      :cart-items="cartStore.items"
      :discount-amount="cartStore.discountAmount"
      @paid="onPaid"
    />

    <!-- 挂单列表 -->
    <el-dialog v-model="showHeldOrders" title="挂单列表" width="400px">
      <div v-if="cartStore.heldOrders.length === 0">
        <el-empty description="暂无挂单" />
      </div>
      <div v-for="h in cartStore.heldOrders" :key="h.id" class="held-item">
        <div>
          <div style="font-weight: 500">{{ h.items.length }} 件商品</div>
          <div style="font-size: 12px; color: #909399">{{ formatTime(h.createdAt) }}</div>
        </div>
        <div>
          <el-button size="small" type="primary" @click="resumeHeld(h.id)">取单</el-button>
          <el-button size="small" type="danger" @click="cartStore.removeHeld(h.id)">删除</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 小票打印 -->
    <ReceiptPrint
      v-if="lastOrder"
      ref="receiptRef"
      :order="lastOrder.order"
      :items="lastOrder.items"
      :payments="lastOrder.payments"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Product, Category, Order, OrderItem, Payment } from '@/types'
import { useCartStore } from '@/stores/cart'
import { searchProducts } from '@/db/products'
import { getCategories } from '@/db/products'
import { getProducts } from '@/db/products'
import { formatMoney } from '@/utils/money'
import { formatTime } from '@/utils/orderNo'
import PayDialog from '@/components/cashier/PayDialog.vue'
import ReceiptPrint from '@/components/cashier/ReceiptPrint.vue'

const cartStore = useCartStore()
const searchInputRef = ref<any>(null)
const searchKeyword = ref('')
const searchResults = ref<Product[]>([])
const categories = ref<Category[]>([])
const quickCatId = ref(0)
const quickProducts = ref<Product[]>([])

const showPayDialog = ref(false)
const showHeldOrders = ref(false)
const receiptRef = ref<any>(null)

const lastOrder = ref<{
  order: Order
  items: OrderItem[]
  payments: Payment[]
} | null>(null)

let searchTimer: ReturnType<typeof setTimeout>

async function handleSearchInput() {
  clearTimeout(searchTimer)
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchResults.value = await searchProducts(searchKeyword.value)
  }, 200)
}

async function handleEnterSearch() {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  const results = await searchProducts(kw)
  if (results.length === 1) {
    addToCart(results[0])
    searchKeyword.value = ''
    searchResults.value = []
  } else {
    searchResults.value = results
  }
}

function addToCart(p: Product) {
  cartStore.addProduct(p)
  searchKeyword.value = ''
  searchResults.value = []
  searchInputRef.value?.focus()
  ElMessage.success({ message: `已添加：${p.name}`, duration: 800, showClose: false })
}

function resumeHeld(id: string) {
  cartStore.resumeOrder(id)
  showHeldOrders.value = false
}

async function onPaid(payload: {
  order: Order
  items: OrderItem[]
  payments: Payment[]
}) {
  lastOrder.value = payload
  showPayDialog.value = false
  cartStore.clearCart()
}

// 快捷商品
watch(quickCatId, async () => {
  const res = await getProducts({ categoryId: quickCatId.value || undefined, pageSize: 30, page: 1 })
  quickProducts.value = res.list.filter((p) => p.isActive)
})

// 键盘快捷键
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'F1') {
    e.preventDefault()
    searchInputRef.value?.focus()
  } else if (e.key === 'F2') {
    e.preventDefault()
    if (cartStore.items.length > 0) showPayDialog.value = true
  } else if (e.key === 'F3') {
    e.preventDefault()
    cartStore.holdOrder()
    ElMessage.info('已挂单')
  } else if (e.ctrlKey && e.key === 'p') {
    e.preventDefault()
    receiptRef.value?.print()
  }
}

onMounted(async () => {
  categories.value = await getCategories()
  if (categories.value.length > 0) {
    quickCatId.value = categories.value[0].id!
  }
  window.addEventListener('keydown', onKeyDown)
  setTimeout(() => searchInputRef.value?.focus(), 200)
})
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.cashier-layout {
  display: flex;
  gap: 12px;
  height: calc(100vh - 94px);
  overflow: hidden;
}
.search-panel {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.search-card { flex-shrink: 0; }
.search-row { display: flex; gap: 8px; }
.search-results {
  position: absolute;
  z-index: 100;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  width: 300px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  margin-top: 4px;
}
.result-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}
.result-item:hover { background: #f5f7fa; }
.result-name { font-size: 14px; }
.result-meta { display: flex; justify-content: space-between; font-size: 12px; color: #909399; }
.result-price { color: #e6a23c; }
.quick-cat-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.cat-tag { cursor: pointer; }
.quick-products {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.quick-item {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
}
.quick-item:hover { border-color: #409eff; background: #ecf5ff; }
.qi-name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qi-price { font-size: 13px; color: #e6a23c; font-weight: 500; margin-top: 2px; }
.cart-panel { flex: 1; overflow: hidden; }
.cart-card { height: 100%; display: flex; flex-direction: column; }
:deep(.cart-card .el-card__body) { flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 0; }
.cart-items { flex: 1; overflow-y: auto; padding: 0 16px; }
.cart-empty { padding: 40px 0; }
.cart-name { font-size: 13px; }
.cart-subtotal { color: #e6a23c; font-weight: 500; }
.cart-footer {
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 14px;
  color: #606266;
}
.discount-row { gap: 6px; }
.grand-total { font-size: 15px; font-weight: 500; color: #303133; }
.grand-amount { font-size: 22px; color: #e6a23c; font-weight: 500; }
.held-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
</style>
