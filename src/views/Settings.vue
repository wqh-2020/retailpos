<template>
  <div class="page-settings">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- ── 店铺信息 ── -->
      <el-tab-pane label="店铺信息" name="shop">
        <el-form :model="shopForm" label-width="90px" style="max-width: 600px">
          <el-form-item label="店铺Logo">
            <div class="logo-upload-row">
              <el-avatar v-if="shopForm.logo" :src="shopForm.logo" :size="64" shape="square" />
              <el-avatar v-else :size="64" shape="square"><el-icon :size="32"><Shop /></el-icon></el-avatar>
              <div class="logo-upload-btns">
                <el-button size="small" @click="logoInputRef?.click()">上传Logo</el-button>
                <el-button v-if="shopForm.logo" size="small" type="danger" @click="removeLogo">删除</el-button>
                <input ref="logoInputRef" type="file" accept="image/*" style="display:none" @change="handleLogoUpload" />
              </div>
              <span class="form-tip">建议尺寸 200×200，支持 PNG/JPG，建议白色或透明背景</span>
            </div>
          </el-form-item>
          <el-form-item label="店铺名称">
            <el-input v-model="shopForm.name" placeholder="例：我的便利店" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="shopForm.phone" placeholder="联系电话" />
          </el-form-item>
          <el-form-item label="店铺地址">
            <el-input v-model="shopForm.address" type="textarea" :rows="2" placeholder="详细地址" />
          </el-form-item>
          <el-form-item label="小票页脚">
            <el-input v-model="shopForm.footer" placeholder="谢谢惠顾，欢迎再来！" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="saveShopInfo">保存信息</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- ── 小票模板 ── -->
      <el-tab-pane label="小票模板" name="receipt">
        <el-form label-width="100px" style="max-width: 480px">
          <el-form-item label="纸张宽度">
            <el-radio-group v-model="receiptForm.paperWidth" @change="saveReceiptConfig">
              <el-radio value="58">58mm</el-radio>
              <el-radio value="80">80mm</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="显示条形码">
            <el-switch v-model="receiptForm.showBarcode" @change="saveReceiptConfig" />
            <span class="form-tip">在小票底部显示订单号条形码</span>
          </el-form-item>
          <el-form-item label="小票页脚">
            <el-input v-model="receiptForm.footer" placeholder="谢谢惠顾，欢迎再来！" @blur="saveReceiptConfig" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="saveReceiptConfig">保存配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- ── 支付方式 ── -->
      <el-tab-pane label="支付方式" name="payment">
        <div class="tab-tip">可拖动行调整顺序，关闭开关则该方式不在收银台显示</div>
        <el-table :data="payMethods" row-key="code" style="max-width: 520px; margin-top: 8px">
          <el-table-column label="支付方式" min-width="120">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 8px">
                <span
                  :style="{ width: '10px', height: '10px', borderRadius: '50%', background: row.color, display: 'inline-block' }"
                />
                <span>{{ row.label }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="找零" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.needChange" type="info" size="small">需找零</el-tag>
              <span v-else style="color: #c0c4cc; font-size: 12px">—</span>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="80" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" size="small" @change="savePayMethods" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ── 操作员管理 ── -->
      <el-tab-pane label="操作员" name="operators">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px">
          <span class="tab-tip">操作员可使用 PIN 码在收银台切换身份</span>
          <el-button type="primary" size="small" @click="openAddOperator">
            <el-icon><Plus /></el-icon> 新增操作员
          </el-button>
        </div>
        <el-table :data="operators" style="max-width: 560px">
          <el-table-column label="姓名" prop="name" />
          <el-table-column label="PIN码" width="100">
            <template #default="{ row }">
              <span style="color: #909399">{{ row.pin ? '******' : '未设置' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
                {{ row.isActive ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEditOperator(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="doDeleteOperator(row)">停用</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ── 数据备份 ── -->
      <el-tab-pane label="数据备份" name="backup">
        <el-alert type="info" :closable="false" style="max-width: 560px; margin-bottom: 16px">
          <template #title>备份说明</template>
          备份将导出全量数据为 JSON 文件，恢复时将完全覆盖当前数据，请谨慎操作。
        </el-alert>
        <div style="display: flex; gap: 12px; flex-wrap: wrap">
          <el-button type="primary" :loading="backingUp" style="width: 160px" @click="doBackup">
            <el-icon><Download /></el-icon> 立即备份
          </el-button>
          <el-button type="warning" :loading="restoring" style="width: 160px" @click="doRestore">
            <el-icon><Upload /></el-icon> 从备份恢复
          </el-button>
        </div>
        <el-card shadow="never" header="关于" style="max-width: 560px; margin-top: 20px">
          <div style="font-size: 13px; color: #606266; line-height: 2.2">
            <div>聚财收银系统 <strong>v1.0.0</strong></div>
            <div>本地离线版，所有数据存储在设备本地 IndexedDB</div>
            <div style="color: #c0c4cc; font-size: 12px; margin-top: 4px">Vue 3 + Electron + Dexie.js</div>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 操作员弹窗 -->
    <el-dialog
      v-model="showOpDialog"
      :title="editingOp.id ? '编辑操作员' : '新增操作员'"
      width="360px"
      :append-to-body="true"
    >
      <el-form :model="editingOp" label-width="70px">
        <el-form-item label="姓名">
          <el-input v-model="editingOp.name" placeholder="员工姓名" />
        </el-form-item>
        <el-form-item label="PIN码">
          <el-input
            v-model="editingOp.pin"
            type="password"
            placeholder="4-6 位数字，留空则不设 PIN"
            maxlength="6"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showOpDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingOp" @click="saveOperator">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, Plus, Shop } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { db } from '@/db'
import { getOperators, addOperator, updateOperator, deleteOperator } from '@/db/reports'
import type { Operator, PaymentMethod } from '@/types'

const settings = useSettingsStore()
const activeTab = ref('shop')
const saving = ref(false)
const backingUp = ref(false)
const restoring = ref(false)

// ── 店铺信息表单 ──
const shopForm = ref({ name: '', phone: '', address: '', footer: '', logo: '' })
const logoInputRef = ref<HTMLInputElement | null>(null)

// ── 小票配置 ──
const receiptForm = ref({ paperWidth: '80', showBarcode: true, footer: '' })

// ── 支付方式 ──
const payMethods = ref<PaymentMethod[]>([])

// ── 操作员 ──
const operators = ref<Operator[]>([])
const showOpDialog = ref(false)
const savingOp = ref(false)
const editingOp = ref<{ id?: number; name: string; pin: string }>({ name: '', pin: '' })

onMounted(async () => {
  await settings.load()
  shopForm.value = {
    name: settings.shopName,
    phone: settings.shopPhone,
    address: settings.shopAddress,
    footer: settings.receiptFooter,
    logo: settings.shopLogo,
  }
  receiptForm.value = {
    paperWidth: settings.receiptPaperWidth || '80',
    showBarcode: settings.receiptShowBarcode,
    footer: settings.receiptFooter,
  }
  payMethods.value = JSON.parse(JSON.stringify(settings.paymentMethods))
  await loadOperators()
})

// 保存店铺信息
async function saveShopInfo() {
  saving.value = true
  try {
    await settings.saveSetting('shop.name', shopForm.value.name)
    await settings.saveSetting('shop.phone', shopForm.value.phone)
    await settings.saveSetting('shop.address', shopForm.value.address)
    await settings.saveSetting('shop.logo', shopForm.value.logo)
    await settings.saveSetting('receipt.footer', shopForm.value.footer)
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

// 上传 Logo（转为 Data URL 存储）
function handleLogoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 2MB')
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    shopForm.value.logo = ev.target?.result as string
  }
  reader.readAsDataURL(file)
  // 清空 input，允许重复选择同一文件
  ;(e.target as HTMLInputElement).value = ''
}

function removeLogo() {
  shopForm.value.logo = ''
}

// 保存小票配置
async function saveReceiptConfig() {
  saving.value = true
  try {
    await settings.saveSetting('receipt.paperWidth', receiptForm.value.paperWidth)
    await settings.saveSetting('receipt.showBarcode', String(receiptForm.value.showBarcode))
    await settings.saveSetting('receipt.footer', receiptForm.value.footer)
    // 同步到店铺表单
    shopForm.value.footer = receiptForm.value.footer
    ElMessage.success('配置已保存')
  } finally {
    saving.value = false
  }
}

// 保存支付方式
async function savePayMethods() {
  await settings.saveSetting('payment.methods', JSON.stringify(payMethods.value))
  ElMessage.success('支付方式已更新')
}

// ── 操作员 ──
async function loadOperators() {
  operators.value = await db.operators.toArray()
}

function openAddOperator() {
  editingOp.value = { name: '', pin: '' }
  showOpDialog.value = true
}

function openEditOperator(row: Operator) {
  editingOp.value = { id: row.id, name: row.name, pin: '' }
  showOpDialog.value = true
}

async function saveOperator() {
  if (!editingOp.value.name.trim()) {
    ElMessage.warning('请输入姓名')
    return
  }
  if (editingOp.value.pin && (editingOp.value.pin.length < 4 || !/^\d+$/.test(editingOp.value.pin))) {
    ElMessage.warning('PIN 码须为 4-6 位数字')
    return
  }
  savingOp.value = true
  try {
    if (editingOp.value.id) {
      await updateOperator(editingOp.value.id, editingOp.value.name, editingOp.value.pin)
    } else {
      await addOperator(editingOp.value.name, editingOp.value.pin)
    }
    ElMessage.success('保存成功')
    showOpDialog.value = false
    await loadOperators()
  } finally {
    savingOp.value = false
  }
}

async function doDeleteOperator(row: Operator) {
  try {
    await ElMessageBox.confirm(`确定停用操作员 "${row.name}"？`, '停用确认', { type: 'warning' })
    await deleteOperator(row.id!)
    ElMessage.success('已停用')
    await loadOperators()
  } catch { /* 取消 */ }
}

// ── 数据备份 ──
async function doBackup() {
  backingUp.value = true
  try {
    const data = {
      products: await db.products.toArray(),
      categories: await db.categories.toArray(),
      orders: await db.orders.toArray(),
      orderItems: await db.orderItems.toArray(),
      payments: await db.payments.toArray(),
      operators: await db.operators.toArray(),
      settings: await db.settings.toArray(),
    }
    const jsonStr = JSON.stringify(data, null, 2)

    if ((window as any).electronAPI) {
      const res = await (window as any).electronAPI.backupSave({ jsonStr })
      if (res.ok) ElMessage.success('备份成功：' + res.filePath)
      else if (!res.canceled) ElMessage.error(res.error || '备份失败')
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `retailpos_backup_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.json`
      a.click()
      URL.revokeObjectURL(url)
      ElMessage.success('备份文件已下载')
    }
  } finally {
    backingUp.value = false
  }
}

async function doRestore() {
  try {
    await ElMessageBox.confirm('恢复将覆盖当前所有数据，确定继续？', '恢复确认', { type: 'warning' })
  } catch { return }
  restoring.value = true
  try {
    let jsonStr = ''
    if ((window as any).electronAPI) {
      const res = await (window as any).electronAPI.backupLoad()
      if (!res.ok) return
      jsonStr = res.content
    } else {
      ElMessage.info('请在 Electron 环境中使用此功能')
      return
    }

    const data = JSON.parse(jsonStr)
    await db.transaction('rw', [db.products, db.categories, db.orders, db.orderItems, db.payments, db.operators, db.settings], async () => {
      await db.products.clear(); await db.products.bulkAdd(data.products ?? [])
      await db.categories.clear(); await db.categories.bulkAdd(data.categories ?? [])
      await db.orders.clear(); await db.orders.bulkAdd(data.orders ?? [])
      await db.orderItems.clear(); await db.orderItems.bulkAdd(data.orderItems ?? [])
      await db.payments.clear(); await db.payments.bulkAdd(data.payments ?? [])
      if (data.operators) { await db.operators.clear(); await db.operators.bulkAdd(data.operators) }
      await db.settings.clear(); await db.settings.bulkAdd(data.settings ?? [])
    })
    await settings.load()
    ElMessage.success('数据恢复成功')
  } catch (e: any) {
    ElMessage.error('恢复失败：' + e.message)
  } finally {
    restoring.value = false
  }
}
</script>

<style scoped>
.page-settings { max-width: 760px; }
.tab-tip { font-size: 12px; color: #909399; }
.form-tip { font-size: 12px; color: #909399; margin-left: 8px; }
.logo-upload-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.logo-upload-btns { display: flex; gap: 8px; }
</style>
