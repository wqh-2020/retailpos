/**
 * Auth Store - 用户登录状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Role } from '@/types'
import * as auth from '@/db/auth'

const TOKEN_KEY = 'retailpos_token'
const USER_KEY = 'retailpos_user'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref<User | null>(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))
  const role = ref<Role | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const permissions = computed<string[]>(() => role.value?.permissions || [])
  const userId = computed(() => user.value?.id)
  const username = computed(() => user.value?.username || '')
  const realname = computed(() => user.value?.realname || '')

  // 权限检查
  function hasPerm(perm: string): boolean {
    if (!role.value) return false
    if (role.value.permissions.includes('*')) return true
    return role.value.permissions.includes(perm)
  }

  // 加载当前用户角色信息
  async function loadRole() {
    if (!user.value?.id) return
    const r = await auth.getRoleByCode(user.value.roleCode)
    if (r) role.value = r
  }

  // 登录
  async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const result = await auth.login(username, password)
    if (!result.success) {
      return { ok: false, error: result.reason }
    }

    const u = result.user
    token.value = `local_${u.id}_${Date.now()}`
    user.value = u

    localStorage.setItem(TOKEN_KEY, token.value)
    localStorage.setItem(USER_KEY, JSON.stringify(u))

    await loadRole()

    // 记录操作日志
    await auth.logOperation({
      userId: u.id!,
      username: u.username,
      action: '登录',
      detail: '用户登录系统',
    })

    return { ok: true }
  }

  // 登出
  async function logout() {
    if (user.value?.id) {
      await auth.logOperation({
        userId: user.value.id,
        username: user.value.username,
        action: '登出',
        detail: '用户退出系统',
      })
    }
    token.value = ''
    user.value = null
    role.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  // 更新个人资料
  async function updateProfile(data: { realname?: string; phone?: string; email?: string }) {
    if (!user.value?.id) return
    await auth.updateUser(user.value.id, data)
    user.value = { ...user.value, ...data }
    localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  // 修改密码
  async function changePassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    if (!user.value?.id) return { ok: false, error: '未登录' }
    const result = await auth.changePassword(user.value.id, oldPassword, newPassword)
    return result
  }

  // 初始化（刷新页面后恢复状态）
  async function init() {
    if (user.value?.id) {
      await loadRole()
    }
  }

  return {
    token,
    user,
    role,
    isLoggedIn,
    permissions,
    userId,
    username,
    realname,
    hasPerm,
    loadRole,
    login,
    logout,
    updateProfile,
    changePassword,
    init,
  }
})
