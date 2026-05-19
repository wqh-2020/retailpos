<template>
  <div class="page-settings">
    <el-row :gutter="16">
      <!-- 店铺信息 -->
      <el-col :span="12">
        <el-card shadow="never" header="店铺信息">
          <el-form :model="shopForm" label-width="80px">
            <el-form-item label="店铺名称">
              <el-input v-model="shopForm.name" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="shopForm.phone" />
            </el-form-item>
            <el-form-item label="店铺地址">
              <el-input v-model="shopForm.address" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="小票页脚">
              <el-input v-model="shopForm.footer" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveShopInfo">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 数据备份 -->
      <el-col :span="12">
        <el-card shadow="never" header="数据备份与恢复">
          <el-space direction="vertical" fill style="width: 100%">
            <el-alert type="info" :closable="false">
              备份将导出全量数据为 JSON 文件，恢复时将覆盖当前数据。
            </el-alert>
            <el-button type="primary" :loading="backingUp" @click="doBackup">
              <el-icon><Download /></el-icon> 立即备份
            </el-button>
            <el-button type="warning" :loading="restoring" @click="doRestore">
              <el-icon><Upload /></el-icon> 从备份恢复
            </el-button>
          </el-space>
        </el-card>

        <el-card shadow="never" header="关于" style="margin-top: 12px">
          <div style="font-size: 13px; color: #606266; line-height: 2">
            <div>零售收银系统 v1.0.0</div>
            <div>本地离线版，数据安全存储在设备上</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { db } from '@/db'

const settings = useSettingsStore()
const saving = ref(false)
const backingUp = ref(false)
const restoring = ref(false)

const shopForm = ref({
  name: '', phone: '', address: '', footer: '',
})

onMounted(() => {
  shopForm.value = {
    name: settings.shopName,
    phone: settings.shopPhone,
    address: settings.shopAddress,
    footer: settings.receiptFooter,
  }
})

async function saveShopInfo() {
  saving.value = true
  try {
    await settings.saveSetting('shop.name', shopForm.value.name)
    await settings.saveSetting('shop.phone', shopForm.value.phone)
    await settings.saveSetting('shop.address', shopForm.value.address)
    await settings.saveSetting('receipt.footer', shopForm.value.footer)
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

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
      a.download = 'retailpos_backup.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  } finally {
    backingUp.value = false
  }
}

async function doRestore() {
  await ElMessageBox.confirm('恢复将覆盖当前所有数据，确定继续？', '恢复确认', { type: 'warning' })
  restoring.value = true
  try {
    let jsonStr = ''
    if ((window as any).electronAPI) {
      const res = await (window as any).electronAPI.backupLoad()
      if (!res.ok) { restoring.value = false; return }
      jsonStr = res.content
    }

    if (!jsonStr) { ElMessage.warning('未选择文件'); return }
    const data = JSON.parse(jsonStr)

    await db.transaction('rw', [db.products, db.categories, db.orders, db.orderItems, db.payments, db.settings], async () => {
      await db.products.clear(); await db.products.bulkAdd(data.products)
      await db.categories.clear(); await db.categories.bulkAdd(data.categories)
      await db.orders.clear(); await db.orders.bulkAdd(data.orders)
      await db.orderItems.clear(); await db.orderItems.bulkAdd(data.orderItems)
      await db.payments.clear(); await db.payments.bulkAdd(data.payments)
      await db.settings.clear(); await db.settings.bulkAdd(data.settings)
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
.page-settings { max-width: 900px; }
</style>
