<template>
  <div class="page">
    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索活动名称" clearable style="width:220px" @change="load">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filterType" placeholder="活动类型" clearable style="width:160px" @change="load">
        <el-option v-for="t in PROMOTION_TYPES" :key="t.value" :label="t.icon + ' ' + t.label" :value="t.value" />
      </el-select>
      <el-select v-model="filterActive" placeholder="状态" clearable style="width:120px" @change="load">
        <el-option label="进行中" :value="true" />
        <el-option label="已停用" :value="false" />
      </el-select>
      <el-button type="primary" @click="openAdd">
        <el-icon><Plus /></el-icon> 新建活动
      </el-button>
    </div>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="name" label="活动名称" min-width="160" />
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          {{ getTypeLabel(row.type) }}
        </template>
      </el-table-column>
      <el-table-column label="规则说明" min-width="240">
        <template #default="{ row }">
          {{ getRuleDesc(row) }}
        </template>
      </el-table-column>
      <el-table-column label="有效期" width="200">
        <template #default="{ row }">
          {{ formatDate(row.startDate) }} ~ {{ formatDate(row.endDate) }}
        </template>
      </el-table-column>
      <el-table-column label="适用等级" width="140">
        <template #default="{ row }">
          {{ row.applicableLevels?.length ? row.applicableLevels.map(l => getLevelLabel(l)).join('/') : '全部会员' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
            {{ row.isActive ? '进行中' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" :type="row.isActive ? 'warning' : 'success'" plain @click="handleToggle(row)">
            {{ row.isActive ? '停用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" plain @click="handleDelete(row)">删除</el-button>
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="isEdit ? '编辑活动' : '新建活动'" width="600px">
      <el-form :model="form" label-width="100px" :rules="rules" ref="formRef">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="如：国庆满减" />
        </el-form-item>
        <el-form-item label="活动类型" prop="type">
          <el-select v-model="form.type" style="width:100%" @change="onTypeChange">
            <el-option v-for="t in PROMOTION_TYPES" :key="t.value" :label="t.icon + ' ' + t.label" :value="t.value" />
          </el-select>
        </el-form-item>

        <!-- 满减 -->
        <template v-if="form.type === 'amount_off'">
          <el-form-item label="满（金额）" prop="thresholdAmount">
            <el-input-number v-model="form.thresholdAmount" :min="0" :precision="2" style="width:100%" />
            <span class="form-tip">达到该金额触发满减（单位：元）</span>
          </el-form-item>
          <el-form-item label="减（金额）" prop="discountAmount">
            <el-input-number v-model="form.discountAmount" :min="0" :precision="2" style="width:100%" />
            <span class="form-tip">满足条件后减去的金额（单位：元）</span>
          </el-form-item>
        </template>

        <!-- 折扣 -->
        <template v-if="form.type === 'percent_off'">
          <el-form-item label="满（金额）" prop="thresholdAmount">
            <el-input-number v-model="form.thresholdAmount" :min="0" :precision="2" style="width:100%" />
            <span class="form-tip">达到该金额触发折扣（单位：元）</span>
          </el-form-item>
          <el-form-item label="折扣率" prop="discountRate">
            <el-input-number v-model="form.discountRate" :min="1" :max="99" style="width:100%" />
            <span class="form-tip">输入1-99，表示打N折</span>
          </el-form-item>
        </template>

        <!-- 买赠 -->
        <template v-if="form.type === 'buy_gift'">
          <el-form-item label="买指定商品">
            <el-select v-model="form.buyProductId" placeholder="选择商品" filterable style="width:100%">
              <el-option v-for="p in productOptions" :key="p.id" :label="p.name + ' - ' + p.barcode" :value="p.id!" />
            </el-select>
          </el-form-item>
          <el-form-item label="买 N 件" prop="buyQuantity">
            <el-input-number v-model="form.buyQuantity" :min="1" style="width:100%" />
          </el-form-item>
          <el-form-item label="送">
            <el-input v-model="form.giftName" placeholder="赠品名称，如：矿泉水1瓶" />
          </el-form-item>
        </template>

        <!-- 价格锁定 -->
        <template v-if="form.type === 'price_lock'">
          <el-form-item label="指定商品">
            <el-select v-model="form.lockProductId" placeholder="选择商品" filterable style="width:100%">
              <el-option v-for="p in productOptions" :key="p.id" :label="p.name + ' - ' + p.barcode" :value="p.id!" />
            </el-select>
          </el-form-item>
          <el-form-item label="优惠价" prop="lockPrice">
            <el-input-number v-model="form.lockPrice" :min="0" :precision="2" style="width:100%" />
            <span class="form-tip">该商品享受的固定价格（单位：元）</span>
          </el-form-item>
        </template>

        <el-form-item label="开始日期" prop="startDate">
          <el-date-picker v-model="form.startDate" type="datetime" style="width:100%" placeholder="活动开始时间" />
        </el-form-item>
        <el-form-item label="结束日期" prop="endDate">
          <el-date-picker v-model="form.endDate" type="datetime" style="width:100%" placeholder="活动结束时间" />
        </el-form-item>
        <el-form-item label="适用会员">
          <el-select v-model="form.applicableLevels" multiple placeholder="不选=全部会员" style="width:100%">
            <el-option v-for="l in MEMBER_LEVELS" :key="l.level" :label="l.icon + ' ' + l.label" :value="l.level" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPromotions, addPromotion, updatePromotion, deletePromotion, togglePromotion } from '@/db/promotions'
import { getLevelLabel, MEMBER_LEVELS } from '@/db/members'
import { getProducts } from '@/db/products'
import { yuanToFen, fenToYuan } from '@/utils/money'
import type { Promotion, PromotionType, MemberLevel, Product } from '@/types'

const PROMOTION_TYPES = [
  { value: 'amount_off',   label: '满减',    icon: '💰' },
  { value: 'percent_off',  label: '折扣',    icon: '🏷️' },
  { value: 'buy_gift',     label: '买赠',    icon: '🎁' },
  { value: 'price_lock',   label: '价格锁定', icon: '🔒' },
]

const keyword = ref('')
const filterType = ref<PromotionType | ''>('')
const filterActive = ref<boolean | ''>('')
const list = ref<Promotion[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const productOptions = ref<Product[]>([])

const formVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formRef = ref()

function makeFormDefaults(): Partial<Promotion> {
  return {
    name: '',
    type: 'amount_off',
    thresholdAmount: undefined,
    discountAmount: undefined,
    discountRate: undefined,
    buyProductId: undefined,
    buyQuantity: undefined,
    giftName: '',
    lockProductId: undefined,
    lockPrice: undefined,
    applicableLevels: [],
    isActive: true,
    startDate: Date.now(),
    endDate: Date.now() + 7 * 86400000,
  }
}

const form = reactive(makeFormDefaults())
const rules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  type: [{ required: true }],
  startDate: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
}

function onTypeChange() {
  // 重置类型相关字段
  Object.assign(form, {
    thresholdAmount: undefined,
    discountAmount: undefined,
    discountRate: undefined,
    buyProductId: undefined,
    buyQuantity: undefined,
    giftName: '',
    lockProductId: undefined,
    lockPrice: undefined,
  })
}

function getTypeLabel(type: PromotionType) {
  return PROMOTION_TYPES.find(t => t.value === type)?.label ?? type
}

function getRuleDesc(p: Promotion): string {
  switch (p.type) {
    case 'amount_off':
      return `满 ${fenToYuan(p.thresholdAmount ?? 0)} 元，减 ${fenToYuan(p.discountAmount ?? 0)} 元`
    case 'percent_off':
      return `满 ${fenToYuan(p.thresholdAmount ?? 0)} 元，享 ${p.discountRate} 折`
    case 'buy_gift':
      return `买 ${p.giftName}（买${p.buyQuantity ?? 1}件送赠品）`
    case 'price_lock':
      return `指定商品享优惠价 ${fenToYuan(p.lockPrice ?? 0)} 元`
    default:
      return '-'
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function openAdd() {
  Object.assign(form, makeFormDefaults())
  isEdit.value = false
  formVisible.value = true
}
function openEdit(row: Promotion) {
  Object.assign(form, {
    ...row,
    startDate: new Date(row.startDate),
    endDate: new Date(row.endDate),
  })
  isEdit.value = true
  formVisible.value = true
}

async function handleSave() {
  await formRef.value.validate()
  saving.value = true
  try {
    const data: Omit<Promotion, 'id'> = {
      name: form.name,
      type: form.type,
      thresholdAmount: form.thresholdAmount !== undefined ? yuanToFen(form.thresholdAmount!) : undefined,
      discountAmount: form.discountAmount !== undefined ? yuanToFen(form.discountAmount!) : undefined,
      discountRate: form.discountRate,
      buyProductId: form.buyProductId,
      buyQuantity: form.buyQuantity,
      giftName: form.giftName,
      lockProductId: form.lockProductId,
      lockPrice: form.lockPrice !== undefined ? yuanToFen(form.lockPrice!) : undefined,
      applicableLevels: form.applicableLevels,
      isActive: form.isActive,
      startDate: form.startDate instanceof Date ? form.startDate.getTime() : form.startDate,
      endDate: form.endDate instanceof Date ? form.endDate.getTime() : form.endDate,
      createdAt: isEdit.value ? form.createdAt! : Date.now(),
      updatedAt: Date.now(),
    }
    if (isEdit.value) {
      await updatePromotion(form.id!, data)
      ElMessage.success('更新成功')
    } else {
      await addPromotion(data)
      ElMessage.success('创建成功')
    }
    formVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function handleToggle(row: Promotion) {
  await togglePromotion(row.id!)
  ElMessage.success(row.isActive ? '已停用' : '已启用')
  load()
}

async function handleDelete(row: Promotion) {
  try {
    await ElMessageBox.confirm(`确认删除活动「${row.name}」？`, '删除确认')
    await deletePromotion(row.id!)
    ElMessage.success('已删除')
    load()
  } catch {}
}

async function load() {
  loading.value = true
  try {
    const res = await getPromotions({
      keyword: keyword.value || undefined,
      type: filterType.value || undefined,
      isActive: filterActive.value !== '' ? filterActive.value : undefined,
      page: page.value,
      pageSize: 20,
    })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  const r = await getProducts({ isActive: true, pageSize: 1000 })
  productOptions.value = r.list
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; gap: 10px; align-items: center; }
.form-tip { font-size: 12px; color: #909399; margin-top: 4px; display: block; }
</style>
