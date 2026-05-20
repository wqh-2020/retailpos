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
        <div class="tab-tip">拖动左侧手柄调整顺序，关闭开关则该方式不在收银台显示</div>
        <el-table
          :data="payMethods"
          row-key="code"
          style="max-width: 520px; margin-top: 8px"
        >
          <el-table-column width="44" align="center" class-name="drag-col">
            <template #default="{ $index }">
              <span
                class="drag-handle"
                @mousedown.prevent="startPayDrag($event, $index)"
              >
                <el-icon :size="14"><Rank /></el-icon>
              </span>
            </template>
          </el-table-column>
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
      </el-tab-pane>
      <!-- ── 授权注册 ── -->
      <el-tab-pane name="license">
        <template #label><el-icon style="margin-right:4px"><Key /></el-icon> 授权注册</template>
        <div style="max-width: 600px">
          <!-- 机器码 -->
          <el-card shadow="never" style="margin-bottom: 16px">
            <template #header>
              <span style="font-weight: 600">本机机器码</span>
            </template>
            <div v-if="isElectron && machineId" style="display: flex; align-items: center; gap: 12px">
              <el-input :model-value="machineId" readonly style="font-family: monospace; font-size: 15px; letter-spacing: 1px; flex: 1" />
              <el-button @click="copyMachineId"><el-icon><CopyDocument /></el-icon> 复制</el-button>
            </div>
            <el-alert v-else type="warning" :closable="false" show-icon>
              非 Electron 环境无法获取机器码，请在桌面客户端中使用此功能。
            </el-alert>
            <div class="form-tip" style="margin-top: 8px">请将此机器码发送给管理员获取激活码</div>
          </el-card>

          <!-- 激活码输入 -->
          <el-card v-if="!licenseStatus.valid" shadow="never" style="margin-bottom: 16px">
            <template #header>
              <span style="font-weight: 600">输入激活码</span>
            </template>
            <div v-if="licenseStatus.trial" style="margin-bottom: 12px; font-size: 13px; color: #e6a23c">
              试用期剩余 <strong>{{ licenseStatus.trialDaysLeft }}</strong> 天，到期后系统将锁定，请尽快激活。
            </div>
            <div style="display: flex; align-items: center; gap: 12px">
              <el-input
                v-model="activationCode"
                placeholder="请输入激活码，如 20261231-A3B2-C1D0-E9F8-G7H6"
                style="font-family: monospace; font-size: 15px; letter-spacing: 1px; flex: 1"
                @keyup.enter="doActivate"
              />
              <el-button type="primary" :loading="activating" @click="doActivate">激活</el-button>
            </div>
          </el-card>

          <!-- 授权状态 -->
          <el-card shadow="never">
            <template #header>
              <span style="font-weight: 600">授权状态</span>
            </template>
            <div v-if="licenseStatus.valid" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px">
              <el-icon :size="20" color="#67c23a"><CircleCheckFilled /></el-icon>
              <span style="font-size: 15px; font-weight: 600; color: #67c23a">已授权</span>
            </div>
            <div v-else-if="licenseStatus.trial" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px">
              <el-icon :size="20" color="#e6a23c"><WarningFilled /></el-icon>
              <span style="font-size: 15px; font-weight: 600; color: #e6a23c">试用中（剩余 {{ licenseStatus.trialDaysLeft }} 天）</span>
            </div>
            <div v-else style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px">
              <el-icon :size="20" color="#f56c6c"><CircleCloseFilled /></el-icon>
              <span style="font-size: 15px; font-weight: 600; color: #f56c6c">{{ licenseStatus.reason }}</span>
            </div>
            <div v-if="licenseStatus.valid" style="font-size: 13px; color: #606266; line-height: 2">
              <div>到期日期：<strong>{{ licenseStatus.license.expiryDate === 'permanent' ? '永久授权' : licenseStatus.license.expiryDate }}</strong></div>
              <div>剩余天数：<strong>{{ licenseStatus.daysLeft === null ? '永久' : licenseStatus.daysLeft + ' 天' }}</strong></div>
              <div>激活时间：{{ new Date(licenseStatus.license.activatedAt).toLocaleString('zh-CN') }}</div>
              <div>激活码：{{ licenseStatus.license.activationCode }}</div>
            </div>
            <el-button
              v-if="licenseStatus.valid"
              type="danger"
              plain
              size="small"
              style="margin-top: 12px"
              @click="doDeactivate"
            >
              <el-icon><Delete /></el-icon> 注销授权
            </el-button>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- ── 关于系统 ── -->
      <el-tab-pane name="about">
        <template #label><el-icon style="margin-right:4px"><InfoFilled /></el-icon> 关于系统</template>
        <div style="max-width: 560px">
          <el-card shadow="never" style="margin-bottom: 16px">
            <div style="text-align: center; padding: 16px 0">
              <div style="font-size: 28px; font-weight: 700; color: #303133; margin-bottom: 8px">聚买买零售收银系统</div>
              <el-tag type="info" size="large">v2.0.0</el-tag>
            </div>
          </el-card>
          <el-card shadow="never" style="margin-bottom: 16px">
            <template #header><span style="font-weight: 600">系统信息</span></template>
            <div style="font-size: 13px; color: #606266; line-height: 2.2">
              <div style="display: flex; justify-content: space-between">
                <span>系统名称</span>
                <span>聚买买零售收银系统（离线桌面版）</span>
              </div>
              <div style="display: flex; justify-content: space-between">
                <span>当前版本</span>
                <span>v2.0.0</span>
              </div>
              <div style="display: flex; justify-content: space-between">
                <span>运行环境</span>
                <span>{{ isElectron ? 'Electron 桌面客户端' : '浏览器（开发模式）' }}</span>
              </div>
              <div style="display: flex; justify-content: space-between">
                <span>授权状态</span>
                <span :style="{ color: licenseStatus.valid ? '#67c23a' : (licenseStatus.trial ? '#e6a23c' : '#f56c6c'), fontWeight: 600 }">
                  {{ licenseStatus.valid
                    ? (licenseStatus.license!.expiryDate === 'permanent' ? '已授权（永久）' : `已授权（剩余 ${licenseStatus.daysLeft} 天）`)
                    : (licenseStatus.trial ? `试用中（剩余 ${licenseStatus.trialDaysLeft} 天）` : licenseStatus.reason) }}
                </span>
              </div>
              <div v-if="isElectron && machineId" style="display: flex; justify-content: space-between">
                <span>机器码</span>
                <span style="font-family: monospace; font-size: 12px">{{ machineId }}</span>
              </div>
            </div>
          </el-card>
          <el-card shadow="never">
            <template #header><span style="font-weight: 600">技术栈</span></template>
            <div style="font-size: 13px; color: #909399; line-height: 2.2">
              <div>前端框架：Vue 3 + TypeScript</div>
              <div>UI 组件：Element Plus</div>
              <div>桌面框架：Electron</div>
              <div>状态管理：Pinia</div>
              <div>本地数据库：Dexie.js (IndexedDB)</div>
              <div>图表库：ECharts</div>
            </div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, Shop, Rank, Key, InfoFilled, CopyDocument, Delete, CircleCheckFilled, CircleCloseFilled, WarningFilled } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { db } from '@/db'
import type { PaymentMethod } from '@/types'
import {
  getLicenseStatus, saveLicense, clearLicense,
  verifyActivationCode, parseActivationExpiry,
  type LicenseData, type LicenseStatus,
} from '@/utils/license'

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

// ── 授权注册 ──
const machineId = ref('')
const activationCode = ref('')
const activating = ref(false)
const licenseStatus = ref<LicenseStatus>({ valid: false, reason: '未授权', trial: false })
const isElectron = !!(window as any).electronAPI?.getMachineId

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
  // 加载授权状态
  licenseStatus.value = getLicenseStatus()
  // 获取机器码
  if (isElectron) {
    const res = await (window as any).electronAPI.getMachineId()
    if (res.ok) machineId.value = res.machineId
  }
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

// ── 支付方式拖拽排序（纯鼠标事件） ──

function startPayDrag(e: MouseEvent, index: number) {
  // 找到表格 tbody
  const tableWrapper = (e.target as HTMLElement).closest('.el-table')
  if (!tableWrapper) return
  const tbody = tableWrapper.querySelector('.el-table__body-wrapper tbody') as HTMLElement
  if (!tbody) return
  const rows = Array.from(tbody.children) as HTMLElement[]
  if (!rows[index]) return

  const rowRect = rows[index].getBoundingClientRect()
  const fromIndex = index

  // 创建拖拽影像（clone）
  const clone = rows[index].cloneNode(true) as HTMLElement
  clone.style.cssText = `
    position: fixed; left: ${rowRect.left}px; top: ${rowRect.top}px;
    width: ${rowRect.width}px; z-index: 9999;
    pointer-events: none; opacity: 0.85;
    background: #ecf5ff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-radius: 4px;
  `
  document.body.appendChild(clone)

  // 原行半透明
  rows[index].style.opacity = '0.3'

  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'

  let currentOver = -1

  function onMove(ev: MouseEvent) {
    clone.style.top = (ev.clientY - rowRect.height / 2) + 'px'

    // 清除所有高亮
    rows.forEach(r => {
      r.style.borderTop = ''
      r.style.borderBottom = ''
    })
    currentOver = -1

    // 判断鼠标在哪行上方/下方
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rRect = r.getBoundingClientRect()
      if (ev.clientY >= rRect.top && ev.clientY <= rRect.bottom) {
        currentOver = i
        if (i !== fromIndex) {
          const mid = rRect.top + rRect.height / 2
          if (ev.clientY < mid) {
            r.style.borderTop = '2px solid #409eff'
          } else {
            r.style.borderBottom = '2px solid #409eff'
          }
        }
        break
      }
    }
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // 清除样式
    rows.forEach(r => {
      r.style.opacity = ''
      r.style.borderTop = ''
      r.style.borderBottom = ''
    })
    clone.remove()

    // 执行排序
    if (currentOver >= 0 && currentOver !== fromIndex) {
      const insertIdx = currentOver > fromIndex ? currentOver + 1 : currentOver
      const [moved] = payMethods.value.splice(fromIndex, 1)
      payMethods.value.splice(insertIdx, 0, moved)
      savePayMethods()
    }
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── 授权注册 ──

async function copyMachineId() {
  if (!machineId.value) return
  try {
    await navigator.clipboard.writeText(machineId.value)
    ElMessage.success('机器码已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择复制')
  }
}

async function doActivate() {
  if (!machineId.value) {
    ElMessage.warning('无法获取机器码，请在 Electron 环境下操作')
    return
  }
  const code = activationCode.value.trim()
  if (!code) {
    ElMessage.warning('请输入激活码')
    return
  }

  activating.value = true
  try {
    // 从激活码自动解析到期日期
    const expiryDate = parseActivationExpiry(code)
    if (!expiryDate) {
      ElMessage.error('激活码格式无效，请检查是否完整')
      return
    }

    const valid = await verifyActivationCode(machineId.value, code)
    if (!valid) {
      ElMessage.error('激活码无效，请检查机器码和激活码是否正确')
      return
    }

    const lic: LicenseData = {
      machineId: machineId.value,
      expiryDate,
      activationCode: code,
      activatedAt: new Date().toISOString(),
    }
    saveLicense(lic)
    licenseStatus.value = getLicenseStatus()
    activationCode.value = ''
    ElMessage.success('授权激活成功！到期日期：' + (expiryDate === 'permanent' ? '永久' : expiryDate))
  } catch (e: any) {
    ElMessage.error('激活失败：' + e.message)
  } finally {
    activating.value = false
  }
}

async function doDeactivate() {
  try {
    await ElMessageBox.confirm(
      '注销授权后系统将无法使用，需要重新激活。确定要注销吗？',
      '注销授权',
      { type: 'warning', confirmButtonText: '确定注销', cancelButtonText: '取消' },
    )
    clearLicense()
    licenseStatus.value = getLicenseStatus()
    ElMessage.success('授权已注销')
  } catch { /* 用户取消 */ }
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
    await db.transaction('rw', [db.products, db.categories, db.orders, db.orderItems, db.payments, db.settings], async () => {
      await db.products.clear(); await db.products.bulkAdd(data.products ?? [])
      await db.categories.clear(); await db.categories.bulkAdd(data.categories ?? [])
      await db.orders.clear(); await db.orders.bulkAdd(data.orders ?? [])
      await db.orderItems.clear(); await db.orderItems.bulkAdd(data.orderItems ?? [])
      await db.payments.clear(); await db.payments.bulkAdd(data.payments ?? [])
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

<!-- 全局样式：拖拽手柄 -->
<style>
.el-table .drag-handle {
  cursor: grab;
  color: #c0c4cc;
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}
.el-table .drag-handle:hover {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}
.el-table .drag-handle:active {
  cursor: grabbing;
}
</style>
