<template>
  <div class="page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索手机号/姓名" clearable style="width:220px" @change="loadMembers">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filterLevel" placeholder="会员等级" clearable style="width:140px" @change="loadMembers">
        <el-option v-for="l in MEMBER_LEVELS" :key="l.level" :label="l.icon + ' ' + l.label" :value="l.level" />
      </el-select>
      <el-button type="primary" @click="openAdd">
        <el-icon><Plus /></el-icon> 新增会员
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">会员总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">活跃会员</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatYuan(stats.totalPoints) }}</div>
        <div class="stat-label">累计积分</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatYuan(stats.availablePoints) }}</div>
        <div class="stat-label">可用积分</div>
      </div>
    </div>

    <!-- 会员列表 -->
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column label="等级" width="100">
        <template #default="{ row }">
          <el-tag :type="levelTagType(row.level)" size="small">
            {{ getLevelLabel(row.level) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="折扣率" width="100">
        <template #default="{ row }">
          {{ row.discountRate === 100 ? '无折扣' : (100 - row.discountRate) + '折' }}
        </template>
      </el-table-column>
      <el-table-column prop="points" label="可用积分" width="110">
        <template #default="{ row }">
          <span class="points-text">{{ row.points.toLocaleString() }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="totalPoints" label="累计积分" width="110">
        <template #default="{ row }">
          {{ row.totalPoints.toLocaleString() }}
        </template>
      </el-table-column>
      <el-table-column prop="birthday" label="生日" width="120" />
      <el-table-column prop="createdAt" label="注册日期" width="170">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="240">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="primary" plain @click="openPoints(row)">积分</el-button>
          <el-button size="small" type="info" plain @click="openLogs(row)">明细</el-button>
          <el-button size="small" type="danger" plain :disabled="!row.isActive" @click="handleDelete(row)">注销</el-button>
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
    <el-dialog v-model="formVisible" :title="isEdit ? '编辑会员' : '新增会员'" width="500px">
      <el-form :model="form" label-width="90px" :rules="rules" ref="formRef">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="唯一标识" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="会员姓名" />
        </el-form-item>
        <el-form-item label="会员等级" prop="level">
          <el-select v-model="form.level" style="width:100%">
            <el-option v-for="l in MEMBER_LEVELS" :key="l.level" :label="l.icon + ' ' + l.label + '（' + (l.discountRate === 100 ? '无折扣' : (100 - l.discountRate) + '折）')" :value="l.level" />
          </el-select>
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="选择生日" />
        </el-form-item>
        <el-form-item label="初始积分">
          <el-input-number v-model="form.points" :min="0" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 积分操作弹窗 -->
    <el-dialog v-model="pointsVisible" title="积分操作" width="440px">
      <el-form :model="pointsForm" label-width="80px">
        <el-form-item label="当前积分">
          <span class="points-text">{{ currentMember?.points.toLocaleString() }}</span>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-radio-group v-model="pointsForm.type">
            <el-radio label="adjust">积分调整</el-radio>
            <el-radio label="redeem">积分兑换</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="积分值">
          <el-input-number v-model="pointsForm.points" :min="1" style="width:100%" />
          <div class="form-tip">调整：正数=增加，负数=减少；兑换：输入要消耗的积分数量</div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="pointsForm.remark" placeholder="操作原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pointsVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePointsOp" :loading="saving">确认</el-button>
      </template>
    </el-dialog>

    <!-- 积分明细弹窗 -->
    <el-dialog v-model="logsVisible" title="积分明细" width="600px">
      <el-table :data="logList" stripe max-height="400">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="logTypeTag(row.type)" size="small">{{ logTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分" width="100">
          <template #default="{ row }">
            <span :class="row.points >= 0 ? 'points-text' : 'points-minus'">
              {{ row.points >= 0 ? '+' : '' }}{{ row.points }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getMembers, addMember, updateMember, deleteMember, getMemberById, adjustPoints, redeemPoints, getMemberPointsLogs, getLevelLabel, MEMBER_LEVELS } from '@/db/members'
import type { Member, MemberLevel, MemberPointsLog } from '@/types'
import { formatYuan, formatDate } from '@/utils/money'
import { getCurrentInstance, toRaw } from 'vue'

const instance = getCurrentInstance()

const keyword = ref('')
const filterLevel = ref<MemberLevel | ''>('')
const list = ref<Member[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)

// 统计
const stats = reactive({ total: 0, active: 0, totalPoints: 0, availablePoints: 0 })

// 表单
const formVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formRef = ref()
const form = reactive({
  id: undefined as number | undefined,
  phone: '',
  name: '',
  level: 'bronze' as MemberLevel,
  birthday: '',
  points: 0,
  remark: '',
  isActive: true,
  createdAt: undefined as number | undefined,
})
const rules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}
function resetForm() {
  Object.assign(form, { id: undefined, phone: '', name: '', level: 'bronze', birthday: '', points: 0, remark: '', isActive: true, createdAt: undefined })
}

function openAdd() {
  resetForm()
  isEdit.value = false
  formVisible.value = true
}
function openEdit(row: Member) {
  Object.assign(form, { ...row, birthday: row.birthday ?? '' })
  isEdit.value = true
  formVisible.value = true
}
async function handleSave() {
  const formComp = formRef.value ?? instance?.refs?.formRef as any
  await formComp.validate()
  saving.value = true
  try {
    const data = {
      ...toRaw(form),
      totalPoints: form.points,
      discountRate: MEMBER_LEVELS.find(l => l.level === form.level)?.discountRate ?? 100,
      createdAt: isEdit.value ? form.createdAt! : Date.now(),
      updatedAt: Date.now(),
    }
    if (isEdit.value) {
      await updateMember(form.id!, data)
      ElMessage.success('更新成功')
    } else {
      await addMember(data)
      ElMessage.success('新增成功')
    }
    formVisible.value = false
    loadMembers()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}
async function handleDelete(row: Member) {
  try {
    await ElMessageBox.confirm(`确认注销会员「${row.name}」？注销后可重新激活。`, '注销确认')
    await deleteMember(row.id!)
    ElMessage.success('已注销')
    loadMembers()
  } catch {}
}

// 积分操作
const pointsVisible = ref(false)
const currentMember = ref<Member | null>(null)
const pointsForm = reactive({ type: 'adjust', points: 0, remark: '' })
function openPoints(row: Member) {
  currentMember.value = row
  pointsForm.type = 'adjust'
  pointsForm.points = 0
  pointsForm.remark = ''
  pointsVisible.value = true
}
async function handlePointsOp() {
  if (!currentMember.value) return
  saving.value = true
  try {
    if (pointsForm.type === 'adjust') {
      await adjustPoints(currentMember.value.id!, pointsForm.points, pointsForm.remark)
      ElMessage.success(`积分${pointsForm.points >= 0 ? '增加' : '减少'}成功`)
    } else {
      await redeemPoints(currentMember.value.id!, pointsForm.points, pointsForm.remark)
      ElMessage.success('积分兑换成功')
    }
    pointsVisible.value = false
    loadMembers()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

// 积分明细
const logsVisible = ref(false)
const logList = ref<MemberPointsLog[]>([])
async function openLogs(row: Member) {
  logList.value = await getMemberPointsLogs(row.id!)
  logsVisible.value = true
}

// 加载
async function loadMembers() {
  loading.value = true
  try {
    const res = await getMembers({
      keyword: keyword.value || undefined,
      level: filterLevel.value || undefined,
      isActive: true,
      page: page.value,
      pageSize: 20,
    })
    list.value = res.list
    total.value = res.total
    // 重新统计
    const all = await getMembers({ isActive: true })
    const arr = all.list
    stats.total = arr.length
    stats.active = arr.filter(m => m.isActive).length
    stats.totalPoints = arr.reduce((s, m) => s + m.totalPoints, 0)
    stats.availablePoints = arr.reduce((s, m) => s + m.points, 0)
  } finally {
    loading.value = false
  }
}

function levelTagType(level: MemberLevel) {
  const map: Record<MemberLevel, string> = { bronze: 'info', silver: '', gold: 'warning', platinum: 'success' }
  return map[level]
}
function logTypeTag(type: MemberPointsLog['type']) {
  const map: Record<string, string> = { earn: 'success', redeem: 'warning', adjust: '', expire: 'danger' }
  return map[type] ?? 'info'
}
function logTypeLabel(type: MemberPointsLog['type']) {
  const map: Record<string, string> = { earn: '获得', redeem: '兑换', adjust: '调整', expire: '过期' }
  return map[type] ?? type
}

onMounted(loadMembers)
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; gap: 10px; align-items: center; }
.stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat-card { background: #fff; border-radius: 8px; padding: 16px; text-align: center; }
.stat-value { font-size: 24px; font-weight: 600; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.points-text { color: #67C23A; font-weight: 500; }
.points-minus { color: #F56C6C; font-weight: 500; }
.form-tip { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
