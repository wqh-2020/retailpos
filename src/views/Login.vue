<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">
          <el-icon size="36" color="#409eff"><ShoppingCart /></el-icon>
        </div>
        <h2 class="login-title">零售收银系统</h2>
        <p class="login-subtitle">请登录以继续</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <template #label><span class="form-label">账号</span></template>
          <el-input
            v-model="form.username"
            placeholder="请输入账号"
            size="large"
            prefix-icon="User"
            autocomplete="username"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item prop="password">
          <template #label><span class="form-label">密码</span></template>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            prefix-icon="Lock"
            show-password
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-btn"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div v-if="errorMsg" class="login-error">
        <el-icon><WarningFilled /></el-icon>
        {{ errorMsg }}
      </div>
    </div>

    <div class="login-footer">
      <span>默认账号：admin / admin123</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { ShoppingCart, WarningFilled } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMsg.value = ''

  try {
    const result = await authStore.login(form.username, form.password)
    if (!result.ok) {
      errorMsg.value = result.error || '登录失败'
      return
    }
    ElMessage.success(`欢迎回来，${authStore.realname}！`)
    router.push('/cashier')
  } catch (e: any) {
    errorMsg.value = e?.message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1d2b3a 0%, #2c3e50 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  background: #fff;
  border-radius: 12px;
  padding: 40px 36px 32px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.login-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  color: #1d2b3a;
}

.login-subtitle {
  margin: 0;
  font-size: 14px;
  color: #909399;
}

.form-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.login-btn {
  width: 100%;
  font-size: 16px;
  height: 44px;
  margin-top: 4px;
}

.login-error {
  margin-top: 12px;
  padding: 10px 14px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 6px;
  color: #f56c6c;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.login-footer {
  margin-top: 24px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}
</style>
