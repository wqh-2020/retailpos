<template>
  <!-- 登录页全屏，无侧边栏 -->
  <router-view v-if="route.path === '/login'" />

  <!-- 已登录主布局 -->
  <el-container v-else class="app-container">
    <el-aside width="180px" class="sidebar">
      <div class="logo">
        <img v-if="shopLogo" :src="shopLogo" class="logo-img" alt="logo" />
        <span v-else class="logo-icon">
          <el-icon size="22"><ShoppingCart /></el-icon>
        </span>
        <span class="logo-text">{{ shopName || '聚财收银系统' }}</span>
      </div>
      <el-menu
        :default-active="activeRoute"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/cashier">
          <el-icon><ShoppingCart /></el-icon>
          <template #title>收银台</template>
        </el-menu-item>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <template #title>商品管理</template>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><List /></el-icon>
          <template #title>流水明细</template>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><DataLine /></el-icon>
          <template #title>报表统计</template>
        </el-menu-item>
        <el-menu-item index="/members">
          <el-icon><User /></el-icon>
          <template #title>会员管理</template>
        </el-menu-item>
        <el-menu-item index="/inventory">
          <el-icon><Box /></el-icon>
          <template #title>库存管理</template>
        </el-menu-item>
        <el-menu-item index="/promotions">
          <el-icon><Discount /></el-icon>
          <template #title>促销管理</template>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>系统设置</template>
        </el-menu-item>
        <!-- 用户权限（需要权限） -->
        <el-menu-item v-if="authStore.hasPerm('user.view')" index="/users">
          <el-icon><Key /></el-icon>
          <template #title>用户权限</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="app-header">
        <span class="header-title">{{ pageTitle }}</span>
        <div class="header-right">
          <span class="header-time">{{ currentTime }}</span>
          <el-tag type="success" size="small">v1.0.0</el-tag>

          <!-- 用户下拉 -->
          <el-dropdown trigger="click" @command="handleUserCommand">
            <span class="user-chip">
              <el-icon><UserFilled /></el-icon>
              <span>{{ authStore.realname }}</span>
              <el-icon class="chevron"><CaretBottom /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile" :icon="User">个人资料</el-dropdown-item>
                <el-dropdown-item command="password" :icon="Lock">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided :icon="SwitchButton">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <!-- 个人资料弹窗 -->
  <el-dialog v-model="profileVisible" title="个人资料" width="440px" destroy-on-close>
    <el-form :model="profileForm" label-width="70px">
      <el-form-item label="账号">
        <el-input :model-value="authStore.username" disabled />
      </el-form-item>
      <el-form-item label="姓名">
        <el-input v-model="profileForm.realname" placeholder="请输入姓名" />
      </el-form-item>
      <el-form-item label="手机">
        <el-input v-model="profileForm.phone" placeholder="请输入手机号" />
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
      </el-form-item>
      <el-form-item label="角色">
        <el-tag type="primary">{{ authStore.role?.name || authStore.user?.roleCode }}</el-tag>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="profileVisible = false">取消</el-button>
      <el-button type="primary" :loading="profileSaving" @click="saveProfile">保存</el-button>
    </template>
  </el-dialog>

  <!-- 修改密码弹窗 -->
  <el-dialog v-model="passwordVisible" title="修改密码" width="400px" destroy-on-close>
    <el-form ref="pwdFormRef" :model="passwordForm" :rules="pwdRules" label-width="80px">
      <el-form-item label="原密码" prop="oldPassword">
        <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="至少 4 位" />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="passwordForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="passwordVisible = false">取消</el-button>
      <el-button type="primary" :loading="pwdSaving" @click="savePassword">确认修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { formatTime } from '@/utils/orderNo'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import {
  ShoppingCart, Goods, List, DataLine, User, Box,
  Discount, Setting,   Key, UserFilled, CaretBottom,
  Lock, SwitchButton,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const currentTime = ref(formatTime(Date.now()))
const activeRoute = computed(() => route.path)
const pageTitle = computed(() => (route.meta?.title as string) ?? '聚财收银系统')
const shopName = computed(() => settingsStore.shopName)
const shopLogo = computed(() => settingsStore.shopLogo)

let timer: ReturnType<typeof setInterval>
onMounted(async () => {
  await settingsStore.load()
})
timer = setInterval(() => {
  currentTime.value = formatTime(Date.now())
}, 1000)

// ─── 个人资料 ────────────────────────────────────────────

const profileVisible = ref(false)
const profileSaving = ref(false)
const profileForm = reactive({ realname: '', phone: '', email: '' })

function openProfile() {
  profileForm.realname = authStore.user?.realname || ''
  profileForm.phone = authStore.user?.phone || ''
  profileForm.email = authStore.user?.email || ''
  profileVisible.value = true
}

async function saveProfile() {
  if (!profileForm.realname.trim()) {
    ElMessage.warning('姓名不能为空')
    return
  }
  profileSaving.value = true
  try {
    await authStore.updateProfile({ realname: profileForm.realname, phone: profileForm.phone, email: profileForm.email })
    profileVisible.value = false
    ElMessage.success('资料已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    profileSaving.value = false
  }
}

// ─── 修改密码 ────────────────────────────────────────────

const passwordVisible = ref(false)
const pwdSaving = ref(false)
const pwdFormRef = ref<FormInstance>()
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 4, message: '密码至少 4 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_: any, value: string, callback: any) => {
        if (value !== passwordForm.newPassword) callback(new Error('两次密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

async function savePassword() {
  if (!pwdFormRef.value) return
  const valid = await pwdFormRef.value.validate().catch(() => false)
  if (!valid) return

  pwdSaving.value = true
  try {
    const result = await authStore.changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    if (!result.ok) {
      ElMessage.error(result.error || '修改失败')
      return
    }
    passwordVisible.value = false
    ElMessage.success('密码修改成功')
    pwdFormRef.value.resetFields()
  } catch (e: any) {
    ElMessage.error(e?.message || '修改失败')
  } finally {
    pwdSaving.value = false
  }
}

// ─── 用户下拉命令 ────────────────────────────────────────

async function handleUserCommand(cmd: string) {
  if (cmd === 'profile') {
    openProfile()
  } else if (cmd === 'password') {
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordVisible.value = true
  } else if (cmd === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
      await authStore.logout()
      router.push('/login')
    } catch {}
  }
}
</script>

<style scoped>
.app-container {
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.sidebar {
  background: #1d2b3a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-left: 0;
  padding-left: 0;
}

:deep(.el-aside) {
  margin-left: 0 !important;
  padding-left: 0 !important;
  border-left: none !important;
  overflow: visible;
}

:deep(.el-container) {
  margin: 0 !important;
  padding: 0 !important;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.logo-icon {
  color: #409eff;
}

.logo-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 4px;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

:deep(.el-menu-item) {
  color: rgba(255,255,255,0.65);
  height: 48px;
  line-height: 48px;
}

:deep(.el-menu-item:hover),
:deep(.el-menu-item.is-active) {
  background: rgba(64,158,255,0.15);
  color: #409eff;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 50px;
}

.header-title {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-time {
  font-size: 13px;
  color: #909399;
  font-variant-numeric: tabular-nums;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 20px;
  background: #f5f7fa;
  color: #606266;
  font-size: 13px;
  transition: background 0.2s;
}

.user-chip:hover {
  background: #ecf5ff;
  color: #409eff;
}

.chevron {
  font-size: 12px;
}

.app-main {
  background: #f5f7fa;
  padding: 16px;
  overflow-y: auto;
}
</style>
