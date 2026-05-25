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
            <el-button link type="danger" size="small" :disabled="cartStore.items.length === 0" @click="handleClearCart">
              清空
            </el-button>
          </div>
        </template>

        <!-- 会员绑定区域 -->
        <div class="member-area">
          <template v-if="!cartStore.currentMember">
            <div class="member-input-row">
              <el-input
                v-model="memberPhone"
                placeholder="输入手机号绑定会员"
                clearable
                size="small"
                prefix-icon="User"
                style="flex: 1"
                @keyup.enter="lookupMember"
              >
                <template #append>
                  <el-button :loading="memberLoading" @click="lookupMember">查询</el-button>
                </template>
              </el-input>
            </div>
          </template>
          <template v-else>
            <div class="member-info-row">
              <div class="member-detail">
                <el-icon style="color: #e6a23c"><UserFilled /></el-icon>
                <span class="member-name">{{ cartStore.currentMember.name }}</span>
                <el-tag size="small" :type="memberLevelType">{{ memberLevelLabel }}</el-tag>
                <span class="member-points">积分：{{ cartStore.currentMember.points }}</span>
              </div>
              <el-button link type="info" size="small" @click="handleUnbindMember">取消</el-button>
            </div>
          </template>
        </div>

        <div class="cart-items">
          <div v-if="cartStore.items.length === 0" class="cart-empty">
            <el-empty description="购物车为空，扫码添加商品" :image-size="80" />
          </div>
          <el-table v-else :data="cartStore.items" size="small" :show-header="true">
            <el-table-column label="商品" min-width="120">
              <template #default="{ row }">
                <div class="cart-name">
                  {{ row.product.name }}
                  <el-tag v-if="row.isGift" size="small" type="warning" style="margin-left: 4px">赠品</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="单价" width="80" align="right">
              <template #default="{ row }">
                <template v-if="row.isGift">
                  <span style="color: #f56c6c; font-size: 12px">免费</span>
                </template>
                <template v-else-if="row.lockedPrice !== undefined">
                  <span style="color: #f56c6c; font-size: 12px; text-decoration: line-through; opacity: 0.6">{{ formatMoney(row.product.price) }}</span>
                  <div style="color: #67c23a; font-size: 12px; font-weight: 500">{{ formatMoney(row.lockedPrice) }}</div>
                </template>
                <template v-else>
                  <span style="color: #606266; font-size: 12px">{{ formatMoney(row.product.price) }}</span>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="80">
              <template #default="{ row }">
                <el-input
                  v-if="!row.isGift"
                  :model-value="String(row.quantity)"
                  size="small"
                  @blur="(e: FocusEvent) => {
                    const v = parseInt((e.target as HTMLInputElement).value) || 1
                    cartStore.updateQuantity(row.product.id!, v)
                    debouncedMatchPromotions()
                  }"
                  @keyup.enter="(e: KeyboardEvent) => {
                    const v = parseInt((e.target as HTMLInputElement).value) || 1
                    cartStore.updateQuantity(row.product.id!, v)
                    ;(e.target as HTMLInputElement).blur()
                  }"
                />
                <span v-else style="font-size: 12px; color: #909399">x{{ row.quantity }}</span>
              </template>
            </el-table-column>
            <el-table-column label="小计" width="90" align="right">
              <template #default="{ row }">
                <span v-if="row.isGift" style="color: #f56c6c; font-size: 12px">¥0.00</span>
                <span v-else class="cart-subtotal">{{ formatMoney(row.subtotal) }}</span>
              </template>
            </el-table-column>
            <el-table-column width="40" fixed="right">
              <template #default="{ row }">
                <el-button v-if="!row.isGift" link type="danger" size="small" @click="cartStore.removeItem(row.product.id!); debouncedMatchPromotions()">
                  <el-icon><Close /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 合计区 -->
        <div class="cart-footer">
          <!-- 促销优惠展示 -->
          <div v-if="cartStore.matchedPromotion" class="total-row promo-row">
            <span>
              <el-tag size="small" type="danger">{{ cartStore.matchedPromotion.name }}</el-tag>
            </span>
            <span style="color: #f56c6c">-{{ formatMoney(cartStore.promotionDiscount) }}</span>
          </div>
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
              @change="debouncedMatchPromotions"
            />
            <span>%</span>
            <span v-if="cartStore.discountAmount > 0" style="color: #f56c6c">
              -{{ formatMoney(cartStore.discountAmount) }}
            </span>
          </div>
          <!-- 结算金额（手动议价） -->
          <div class="total-row settlement-row">
            <span>结算金额</span>
            <el-input-number
              :model-value="settlementAmount"
              :min="0"
              :precision="2"
              :step="10"
              size="small"
              style="width: 110px"
              @update:model-value="onSettlementInput"
            />
            <span class="yuan">元</span>
            <el-button
              v-if="cartStore.manualDiscount > 0"
              link
              size="small"
              type="danger"
              @click="clearSettlement"
            >清除</el-button>
          </div>
          <div v-if="cartStore.manualDiscount > 0" class="total-row manual-discount-row">
            <span>手动减免</span>
            <span style="color: #f56c6c">-{{ formatMoney(cartStore.manualDiscount) }}</span>
          </div>
          <!-- 积分抵扣 -->
          <div v-if="cartStore.currentMember && cartStore.currentMember.points > 0" class="total-row points-row">
            <span class="points-label">
              积分抵扣
              <el-tooltip content="10积分=1元" placement="top">
                <el-icon style="cursor: help; font-size: 12px"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
            <div class="points-input">
              <el-input-number
                :model-value="cartStore.pointsToRedeem"
                :min="0"
                :max="maxPointsCanRedeem"
                size="small"
                style="width: 100px"
                @update:model-value="(v: number | undefined) => cartStore.setPointsToRedeem(v || 0)"
              />
              <span class="points-amount" v-if="cartStore.pointsDeductAmount > 0">
                (-{{ formatMoney(cartStore.pointsDeductAmount) }})
              </span>
            </div>
          </div>
          <div class="total-row grand-total">
            <span>合计</span>
            <span class="grand-amount">{{ formatMoney(cartStore.total) }}</span>
          </div>
          <!-- 实收金额输入 -->
          <div class="total-row actual-amount-row">
            <span>实收金额</span>
            <el-input-number
              v-model="actualAmount"
              :min="0"
              :precision="2"
              :step="10"
              size="small"
              style="width: 110px"
              @change="onActualAmountChange"
            />
            <span class="yuan">元</span>
          </div>
          <div v-if="changeAmount > 0" class="total-row change-row">
            <span>找零</span>
            <span class="change-amount">{{ formatMoney(changeAmount) }}</span>
          </div>
          <el-button
            type="primary"
            size="large"
            style="width: 100%; margin-top: 12px; font-size: 16px; height: 48px"
            :disabled="cartStore.items.length === 0 || cartStore.items.every(i => i.isGift)"
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
      :discount-amount="cartStore.discountAmount + cartStore.promotionDiscount + cartStore.manualDiscount"
      :member="cartStore.currentMember"
      :points-to-redeem="cartStore.pointsToRedeem"
      :matched-promotion="cartStore.matchedPromotion"
      :actual-amount="actualAmount"
      :manual-discount="cartStore.manualDiscount"
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Product, Category, Order, OrderItem, Payment, Member } from '@/types'
import { useCartStore } from '@/stores/cart'
import { searchProducts } from '@/db/products'
import { getCategories } from '@/db/products'
import { getProducts } from '@/db/products'
import { getMemberByPhone } from '@/db/members'
import { getLevelLabel, MEMBER_LEVELS } from '@/db/members'
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
const actualAmount = ref(0)  // 实收金额（元）
const settlementAmount = ref<number | undefined>(undefined)  // 结算金额（元）

// ─── 会员相关 ─────────────────────────────────
const memberPhone = ref('')
const memberLoading = ref(false)

const memberLevelLabel = computed(() => {
  if (!cartStore.currentMember) return ''
  return getLevelLabel(cartStore.currentMember.level)
})

const memberLevelType = computed(() => {
  if (!cartStore.currentMember) return 'info'
  const levelMap: Record<string, string> = {
    bronze: 'info',
    silver: '',
    gold: 'warning',
    platinum: 'danger',
  }
  return levelMap[cartStore.currentMember.level] || 'info'
})

const maxPointsCanRedeem = computed(() => {
  if (!cartStore.currentMember) return 0
  const memberPts = cartStore.currentMember.points
  const subtotalAfterDiscount = cartStore.subtotal - cartStore.discountAmount - cartStore.promotionDiscount
  const maxByAmount = subtotalAfterDiscount > 0 ? Math.floor(subtotalAfterDiscount / 10) : 0
  return Math.min(memberPts, maxByAmount)
})

// 找零金额（分）
const changeAmount = computed(() => {
  if (actualAmount.value <= 0) return 0
  const actualFen = Math.round(actualAmount.value * 100)
  return Math.max(0, actualFen - cartStore.total)
})

function onActualAmountChange() {
  // 实收金额变化时，如果小于应付金额，提示
  if (actualAmount.value > 0 && actualAmount.value * 100 < cartStore.total) {
    ElMessage.warning('实收金额小于应付金额')
  }
}

// 结算金额输入处理
function onSettlementInput(v: number | undefined) {
  settlementAmount.value = v
  cartStore.setSettlementAmount(v || 0)
}

function clearSettlement() {
  settlementAmount.value = undefined
  cartStore.clearManualDiscount()
}

async function lookupMember() {
  const phone = memberPhone.value.trim()
  if (!phone) return
  memberLoading.value = true
  try {
    const member = await getMemberByPhone(phone)
    if (!member) {
      ElMessage.warning('未找到该会员')
      return
    }
    if (!member.isActive) {
      ElMessage.warning('该会员已注销')
      return
    }
    cartStore.bindMember(member)
    ElMessage.success(`已绑定会员：${member.name}`)
  } finally {
    memberLoading.value = false
  }
}

function handleUnbindMember() {
  cartStore.unbindMember()
  memberPhone.value = ''
  ElMessage.info('已取消会员绑定')
}

function handleClearCart() {
  cartStore.clearCart()
}

const lastOrder = ref<{
  order: Order
  items: OrderItem[]
  payments: Payment[]
} | null>(null)

let searchTimer: ReturnType<typeof setTimeout>
let promoMatchTimer: ReturnType<typeof setTimeout>

function debouncedMatchPromotions() {
  clearTimeout(promoMatchTimer)
  promoMatchTimer = setTimeout(() => {
    cartStore.matchPromotions()
  }, 300)
}

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
  // 添加商品后重新匹配促销
  debouncedMatchPromotions()
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
  actualAmount.value = 0  // 重置实收金额
  settlementAmount.value = undefined  // 重置结算金额

  // 询问是否打印小票
  try {
    const { value } = await ElMessageBox.confirm('收款成功！是否打印小票？', '打印小票', {
      confirmButtonText: '不打印',
      cancelButtonText: '打印',
      type: 'success',
      distinguishCancelAndClose: true,
    })
    // 不打印（确认按钮），直接结束
  } catch (action: any) {
    // 用户点击了"打印"按钮（取消），打印小票
    if (action === 'cancel') {
      receiptRef.value?.print()
    }
  }
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
    if (cartStore.items.length > 0 && !cartStore.items.every(i => i.isGift)) showPayDialog.value = true
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

/* 会员区域 */
.member-area {
  padding: 8px 16px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.member-input-row { display: flex; gap: 8px; }
.member-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.member-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.member-name { font-weight: 500; color: #303133; }
.member-points { color: #e6a23c; font-size: 12px; }

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
.promo-row { margin-bottom: 4px; }
.grand-total { font-size: 15px; font-weight: 500; color: #303133; }
.grand-amount { font-size: 22px; color: #e6a23c; font-weight: 500; }

/* 实收金额 */
.actual-amount-row { align-items: center; gap: 6px; }
.yuan { font-size: 13px; color: #606266; }
.change-row { color: #67c23a; font-weight: 500; }
.change-amount { font-size: 16px; color: #67c23a; }

/* 结算金额 */
.settlement-row { align-items: center; gap: 6px; }
.manual-discount-row { color: #f56c6c; font-weight: 500; }

/* 积分抵扣 */
.points-row { font-size: 13px; }
.points-label { display: flex; align-items: center; gap: 4px; color: #909399; }
.points-input { display: flex; align-items: center; gap: 6px; }
.points-amount { color: #f56c6c; font-size: 12px; }

.held-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
</style>
