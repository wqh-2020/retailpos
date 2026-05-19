<template>
  <div class="users-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          placeholder="搜索账号/姓名/手机"
          clearable
          style="width: 220px"
          @input="debouncedLoad"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filterRole" placeholder="角色" clearable style="width: 140px" @change="loadUsers">
          <el-option v-for="r in roles" :key="r.code" :label="r.name" :value="r.code" />
        </el-select>
        <el-select v-model="filterActive" placeholder="状态" clearable style="width: 120px" @change="loadUsers">
          <el-option label="启用" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openUserDialog()">
          新增用户
        </el-button>
        <el-button v-if="authStore.hasPerm('oplog.view')" :icon="Tickets" @click="openLogsDrawer">
          操作日志
        </el-button>
      </div>
    </div>

    <!-- 用户列表 -->
    <el-table :data="users" stripe v-loading="loading" row-key="id">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="账号" min-width="100" />
      <el-table-column prop="realname" label="姓名" min-width="100" />
      <el-table-column label="角色" min-width="120">
        <template #default="{ row }">
          <el-tag size="small" type="primary">{{ getRoleName(row.roleCode) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机" min-width="130" />
      <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
            {{ row.isActive ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后登录" min-width="160">
        <template #default="{ row }">
          {{ row.lastLoginAt ? formatTs(row.lastLoginAt) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="160">
        <template #default="{ row }">{{ formatTs(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openUserDialog(row)">编辑</el-button>
          <el-button
            v-if="authStore.hasPerm('user.reset_pwd')"
            type="warning" link size="small"
            @click="openResetPwd(row)"
          >重置密码</el-button>
          <el-button
            v-if="authStore.hasPerm('user.delete') && row.id !== authStore.userId"
            type="danger" link size="small"
            @click="deleteUser(row)"
          >删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadUsers"
      />
    </div>

    <!-- 新增/编辑用户弹窗 -->
    <el-dialog
      v-model="userDialogVisible"
      :title="editingUser?.id ? '编辑用户' : '新增用户'"
      width="500px"
      destroy-on-close
    >
      <el-form ref="userFormRef" :model="userForm" :rules="userRules" label-width="80px">
        <el-form-item label="账号" prop="username">
          <el-input v-model="userForm.username" :disabled="!!editingUser?.id" placeholder="登录账号" />
        </el-form-item>
        <el-form-item v-if="!editingUser?.id" label="密码" prop="password">
          <el-input v-model="userForm.password" type="password" show-password placeholder="初始密码" />
        </el-form-item>
        <el-form-item label="姓名" prop="realname">
          <el-input v-model="userForm.realname" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="角色" prop="roleCode">
          <el-select v-model="userForm.roleCode" style="width: 100%">
            <el-option v-for="r in roles" :key="r.code" :label="r.name" :value="r.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机" prop="phone">
          <el-input v-model="userForm.phone" placeholder="手机号码" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="userForm.email" placeholder="邮箱地址" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="userForm.isActive" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="userSaving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="resetPwdVisible" title="重置密码" width="380px" destroy-on-close>
      <p style="margin: 0 0 16px; color: #606266">
        为用户 <strong>{{ resetPwdUser?.realname }}</strong> 重置密码
      </p>
      <el-form ref="resetPwdFormRef" :model="resetPwdForm" :rules="resetPwdRules" label-width="70px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="resetPwdForm.newPassword" type="password" show-password placeholder="至少 4 位" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="resetPwdForm.confirmPassword" type="password" show-password placeholder="再次输入" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetPwdSaving" @click="doResetPwd">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 用户详情 + 角色管理抽屉 -->
    <el-drawer v-model="roleDrawerVisible" title="角色与权限管理" size="780px" direction="rtl">
      <!-- 角色列表 Tab -->
      <div class="role-tabs">
        <el-tabs v-model="activeRoleCode" @tab-change="loadRolePermissions">
          <el-tab-pane v-for="r in roles" :key="r.code" :label="r.name" :name="r.code" />
        </el-tabs>
        <div class="role-actions">
          <el-button v-if="authStore.hasPerm('role.create')" size="small" :icon="Plus" @click="openRoleDialog()">新增角色</el-button>
          <el-button
            v-if="authStore.hasPerm('role.edit')"
            size="small"
            :icon="DocumentCopy"
            :disabled="!activeRole"
            @click="openCopyPermDialog"
          >复制权限</el-button>
        </div>
      </div>

      <!-- 当前角色信息 -->
      <div v-if="activeRole" class="role-info">
        <el-form label-width="70px" style="max-width: 500px">
          <el-form-item label="角色名称">
            <el-input v-if="roleEditing" v-model="roleEditForm.name" />
            <span v-else>{{ activeRole.name }}</span>
            <el-button
              v-if="authStore.hasPerm('role.edit') && !roleEditing"
              type="primary" link size="small"
              style="margin-left: 8px"
              @click="startRoleEdit"
            >编辑</el-button>
            <template v-if="roleEditing">
              <el-button size="small" @click="roleEditing = false">取消</el-button>
              <el-button type="primary" size="small" :loading="roleSaving" @click="saveRoleInfo">保存</el-button>
            </template>
          </el-form-item>
          <el-form-item label="角色编码">
            <span>{{ activeRole.code }}</span>
            <el-tag v-if="!activeRole.canDelete" type="warning" size="small" style="margin-left: 8px">内置</el-tag>
          </el-form-item>
          <el-form-item label="描述">
            <span>{{ activeRole.description || '-' }}</span>
          </el-form-item>
          <el-form-item>
            <el-button
              v-if="authStore.hasPerm('role.delete') && activeRole.canDelete"
              type="danger" size="small"
              @click="deleteCurrentRole"
            >删除角色</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 权限矩阵 -->
      <div v-if="activeRole && authStore.hasPerm('role.edit')" class="perm-matrix">
        <div class="perm-matrix-title">权限配置</div>
        <el-checkbox
          v-model="permAllChecked"
          :indeterminate="permIndeterminate"
          @change="toggleAllPerms"
          style="margin-bottom: 12px"
        >全选</el-checkbox>
        <div v-for="cat in permCategories" :key="cat.key" class="perm-category">
          <div class="perm-cat-title">
            <el-checkbox
              :model-value="isCatAllChecked(cat.key)"
              :indeterminate="isCatIndeterminate(cat.key)"
              @change="toggleCatPerms(cat.key)"
            >{{ cat.label }}</el-checkbox>
          </div>
          <div class="perm-items">
            <el-checkbox
              v-for="p in getCatPerms(cat.key)"
              :key="p.code"
              v-model="localPerms"
              :value="p.code"
              :disabled="!activeRole.canDelete && activeRole.code === 'admin'"
              style="width: 140px; margin-bottom: 4px"
            >{{ p.name }}</el-checkbox>
          </div>
        </div>
        <div class="perm-save">
          <el-button type="primary" :loading="permSaving" @click="saveRolePermissions">保存权限</el-button>
        </div>
      </div>

      <!-- 只读权限展示 -->
      <div v-else-if="activeRole" class="perm-readonly">
        <div v-for="cat in permCategories" :key="cat.key" class="perm-category perm-category--readonly">
          <div class="perm-cat-title">{{ cat.label }}</div>
          <div class="perm-items">
            <el-tag
              v-for="p in getRoleCatPerms(activeRole.permissions, cat.key)"
              :key="p.code"
              size="small"
              style="margin: 2px 4px"
            >{{ p.name }}</el-tag>
            <span v-if="!getRoleCatPerms(activeRole.permissions, cat.key).length" class="no-perm">无</span>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 新增角色弹窗 -->
    <el-dialog v-model="newRoleVisible" title="新增角色" width="400px" destroy-on-close>
      <el-form ref="newRoleFormRef" :model="newRoleForm" :rules="newRoleRules" label-width="80px">
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="newRoleForm.code" placeholder="如：clerk" />
        </el-form-item>
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="newRoleForm.name" placeholder="如：店员" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newRoleForm.description" type="textarea" :rows="2" placeholder="简要描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newRoleVisible = false">取消</el-button>
        <el-button type="primary" :loading="newRoleSaving" @click="doCreateRole">创建</el-button>
      </template>
    </el-dialog>

    <!-- 复制权限弹窗 -->
    <el-dialog v-model="copyPermVisible" title="复制其他角色权限" width="400px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="从角色复制">
          <el-select v-model="copyFromRole" style="width: 100%">
            <el-option v-for="r in roles.filter(x => x.code !== activeRoleCode)" :key="r.code" :label="r.name" :value="r.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="到">
          <span>{{ activeRole?.name }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyPermVisible = false">取消</el-button>
        <el-button type="primary" :loading="copyPermSaving" @click="doCopyPerms">确认复制</el-button>
      </template>
    </el-dialog>

    <!-- 操作日志抽屉 -->
    <el-drawer v-model="logsDrawerVisible" title="操作日志" size="900px" direction="rtl">
      <div class="logs-toolbar">
        <el-input v-model="logKeyword" placeholder="关键词" clearable style="width: 180px" @input="debouncedLoadLogs" />
        <el-select v-model="logUserId" placeholder="操作用户" clearable style="width: 150px" @change="loadLogs">
          <el-option v-for="u in allUsers" :key="u.id" :label="u.realname || u.username" :value="u.id" />
        </el-select>
        <el-date-picker
          v-model="logDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="x"
          style="width: 240px"
          @change="loadLogs"
        />
        <el-button :icon="Download" :disabled="!logs.length" @click="exportLogs">导出 CSV</el-button>
        <el-button :icon="Refresh" @click="loadLogs">刷新</el-button>
      </div>

      <el-table :data="logs" stripe v-loading="logsLoading" size="small">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTs(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="action" label="操作" width="120" />
        <el-table-column prop="targetType" label="对象类型" width="100" />
        <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="logPage"
          :page-size="logPageSize"
          :total="logTotal"
          layout="total, prev, pager, next"
          @current-change="loadLogs"
        />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { ALL_PERMISSIONS } from '@/db/index'
import * as auth from '@/db/auth'
import type { User, Role, OperationLog } from '@/types'
import {
  Plus, Search, Tickets, Download, Refresh, DocumentCopy,
} from '@element-plus/icons-vue'

const authStore = useAuthStore()

// ─── 数据 ────────────────────────────────────────────────

const roles = ref<Role[]>([])
const users = ref<User[]>([])
const allUsers = ref<User[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

// 筛选
const keyword = ref('')
const filterRole = ref('')
const filterActive = ref<boolean | ''>('')
let loadTimer: ReturnType<typeof setTimeout>

function debouncedLoad() {
  clearTimeout(loadTimer)
  loadTimer = setTimeout(() => { page.value = 1; loadUsers() }, 350)
}

// ─── 加载用户 ────────────────────────────────────────────

async function loadUsers() {
  loading.value = true
  try {
    const result = await auth.getUsers({
      keyword: keyword.value,
      roleCode: filterRole.value || undefined,
      isActive: filterActive.value === '' ? undefined : filterActive.value,
      page: page.value,
      pageSize: pageSize.value,
    })
    users.value = result.list
    total.value = result.total
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// ─── 加载角色 ────────────────────────────────────────────

async function loadRoles() {
  roles.value = await auth.getRoles()
}

// ─── 用户弹窗 ────────────────────────────────────────────

const userDialogVisible = ref(false)
const userSaving = ref(false)
const userFormRef = ref<FormInstance>()
const editingUser = ref<User | null>(null)

const userForm = reactive({
  username: '', password: '', realname: '', roleCode: '',
  phone: '', email: '', isActive: true,
})

const userRules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 4, message: '密码至少 4 位', trigger: 'blur' }],
  realname: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

function openUserDialog(user?: User) {
  editingUser.value = user || null
  if (user) {
    userForm.username = user.username
    userForm.password = ''
    userForm.realname = user.realname
    userForm.roleCode = user.roleCode
    userForm.phone = user.phone || ''
    userForm.email = user.email || ''
    userForm.isActive = user.isActive
  } else {
    userFormRef.value?.resetFields()
    userForm.username = ''
    userForm.password = ''
    userForm.realname = ''
    userForm.roleCode = roles.value[0]?.code || ''
    userForm.phone = ''
    userForm.email = ''
    userForm.isActive = true
  }
  userDialogVisible.value = true
}

async function saveUser() {
  if (!userFormRef.value) return
  const valid = await userFormRef.value.validate().catch(() => false)
  if (!valid) return

  userSaving.value = true
  try {
    if (editingUser.value?.id) {
      await auth.updateUser(editingUser.value.id, {
        realname: userForm.realname,
        roleCode: userForm.roleCode,
        phone: userForm.phone || undefined,
        email: userForm.email || undefined,
        isActive: userForm.isActive,
      })
      await auth.logOperation({ userId: authStore.userId!, username: authStore.username, action: '编辑用户', targetType: 'User', targetId: editingUser.value.id, detail: `编辑用户 ${userForm.realname}` })
      ElMessage.success('用户已更新')
    } else {
      const u = await auth.createUser({
        username: userForm.username,
        password: userForm.password,
        realname: userForm.realname,
        roleCode: userForm.roleCode,
        phone: userForm.phone || undefined,
        email: userForm.email || undefined,
        isActive: userForm.isActive,
      })
      await auth.logOperation({ userId: authStore.userId!, username: authStore.username, action: '新增用户', targetType: 'User', targetId: u.id, detail: `新增用户 ${userForm.realname}` })
      ElMessage.success('用户已创建')
    }
    userDialogVisible.value = false
    loadUsers()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    userSaving.value = false
  }
}

async function deleteUser(user: User) {
  try {
    await ElMessageBox.confirm(`确定删除用户 "${user.realname}"（${user.username}）？`, '确认删除', { type: 'warning' })
    await auth.deleteUser(user.id!)
    await auth.logOperation({ userId: authStore.userId!, username: authStore.username, action: '删除用户', targetType: 'User', targetId: user.id, detail: `删除用户 ${user.realname}` })
    ElMessage.success('已删除')
    loadUsers()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

// ─── 重置密码 ────────────────────────────────────────────

const resetPwdVisible = ref(false)
const resetPwdSaving = ref(false)
const resetPwdUser = ref<User | null>(null)
const resetPwdFormRef = ref<FormInstance>()
const resetPwdForm = reactive({ newPassword: '', confirmPassword: '' })

const resetPwdRules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 4, message: '密码至少 4 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入', trigger: 'blur' },
    {
      validator: (_: any, value: string, callback: any) => {
        if (value !== resetPwdForm.newPassword) callback(new Error('两次密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

function openResetPwd(user: User) {
  resetPwdUser.value = user
  resetPwdForm.newPassword = ''
  resetPwdForm.confirmPassword = ''
  resetPwdVisible.value = true
}

async function doResetPwd() {
  if (!resetPwdFormRef.value) return
  const valid = await resetPwdFormRef.value.validate().catch(() => false)
  if (!valid) return

  resetPwdSaving.value = true
  try {
    await auth.resetUserPassword(resetPwdUser.value!.id!, resetPwdForm.newPassword)
    await auth.logOperation({ userId: authStore.userId!, username: authStore.username, action: '重置密码', targetType: 'User', targetId: resetPwdUser.value!.id, detail: `为用户 ${resetPwdUser.value!.realname} 重置密码` })
    resetPwdVisible.value = false
    ElMessage.success('密码已重置')
  } catch (e: any) {
    ElMessage.error(e?.message || '重置失败')
  } finally {
    resetPwdSaving.value = false
  }
}

// ─── 角色管理 ────────────────────────────────────────────

const roleDrawerVisible = ref(false)
const activeRoleCode = ref('')
const roleEditing = ref(false)
const roleSaving = ref(false)
const roleEditForm = reactive({ name: '' })

const activeRole = computed(() => roles.value.find(r => r.code === activeRoleCode.value))

// 权限相关
const localPerms = ref<string[]>([])
const permSaving = ref(false)
const permAllChecked = computed({
  get: () => activeRole.value ? localPerms.value.length === ALL_PERMISSIONS.length : false,
  set: () => {},
})
const permIndeterminate = computed(() => {
  const l = localPerms.value.length
  const t = ALL_PERMISSIONS.length
  return l > 0 && l < t
})

const permCategories = [
  { key: 'cashier',   label: '收银管理' },
  { key: 'product',   label: '商品管理' },
  { key: 'order',     label: '订单管理' },
  { key: 'stats',     label: '报表统计' },
  { key: 'member',    label: '会员管理' },
  { key: 'stock',     label: '库存管理' },
  { key: 'promotion', label: '促销管理' },
  { key: 'system',    label: '系统管理' },
]

function getCatPerms(cat: string) {
  return ALL_PERMISSIONS.filter(p => p.category === cat)
}

function getRoleCatPerms(perms: string[], cat: string) {
  return ALL_PERMISSIONS.filter(p => p.category === cat && perms.includes(p.code))
}

function isCatAllChecked(cat: string) {
  const catPerms = getCatPerms(cat).map(p => p.code)
  return catPerms.every(c => localPerms.value.includes(c))
}

function isCatIndeterminate(cat: string) {
  const catPerms = getCatPerms(cat).map(p => p.code)
  const checked = catPerms.filter(c => localPerms.value.includes(c))
  return checked.length > 0 && checked.length < catPerms.length
}

function toggleCatPerms(cat: string) {
  const catPerms = getCatPerms(cat).map(p => p.code)
  const allChecked = isCatAllChecked(cat)
  if (allChecked) {
    localPerms.value = localPerms.value.filter(c => !catPerms.includes(c))
  } else {
    const merged = new Set([...localPerms.value, ...catPerms])
    localPerms.value = Array.from(merged)
  }
}

function toggleAllPerms(checked: boolean) {
  if (checked) {
    localPerms.value = ALL_PERMISSIONS.map(p => p.code)
  } else {
    localPerms.value = []
  }
}

function loadRolePermissions() {
  if (!activeRole.value) return
  localPerms.value = [...(activeRole.value.permissions || [])]
}

async function saveRolePermissions() {
  if (!activeRole.value) return
  permSaving.value = true
  try {
    await auth.updateRole(activeRole.value.code, { permissions: localPerms.value })
    // 重新加载角色数据并更新 store
    await loadRoles()
    if (authStore.user?.roleCode === activeRole.value.code) {
      await authStore.loadRole()
    }
    await auth.logOperation({ userId: authStore.userId!, username: authStore.username, action: '更新角色权限', targetType: 'Role', detail: `更新角色 "${activeRole.value.name}" 的权限` })
    ElMessage.success('权限已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    permSaving.value = false
  }
}

function startRoleEdit() {
  if (!activeRole.value) return
  roleEditForm.name = activeRole.value.name
  roleEditing.value = true
}

async function saveRoleInfo() {
  if (!activeRole.value) return
  roleSaving.value = true
  try {
    await auth.updateRole(activeRole.value.code, { name: roleEditForm.name })
    await loadRoles()
    roleEditing.value = false
    ElMessage.success('角色名称已更新')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    roleSaving.value = false
  }
}

async function deleteCurrentRole() {
  if (!activeRole.value) return
  try {
    const result = await auth.deleteRole(activeRole.value.code)
    if (!result.ok) {
      ElMessage.error(result.reason || '删除失败')
      return
    }
    await loadRoles()
    if (roles.value.length > 0) activeRoleCode.value = roles.value[0].code
    ElMessage.success('角色已删除')
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

// ─── 新增角色 ────────────────────────────────────────────

const newRoleVisible = ref(false)
const newRoleSaving = ref(false)
const newRoleFormRef = ref<FormInstance>()
const newRoleForm = reactive({ code: '', name: '', description: '' })

const newRoleRules: FormRules = {
  code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
}

async function doCreateRole() {
  if (!newRoleFormRef.value) return
  const valid = await newRoleFormRef.value.validate().catch(() => false)
  if (!valid) return

  newRoleSaving.value = true
  try {
    await auth.createRole({ code: newRoleForm.code, name: newRoleForm.name, description: newRoleForm.description })
    await auth.logOperation({ userId: authStore.userId!, username: authStore.username, action: '新增角色', targetType: 'Role', detail: `新增角色 "${newRoleForm.name}"` })
    newRoleVisible.value = false
    await loadRoles()
    activeRoleCode.value = newRoleForm.code
    ElMessage.success('角色已创建')
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    newRoleSaving.value = false
  }
}

function openRoleDialog() {
  newRoleForm.code = ''
  newRoleForm.name = ''
  newRoleForm.description = ''
  newRoleVisible.value = true
}

// ─── 复制权限 ────────────────────────────────────────────

const copyPermVisible = ref(false)
const copyFromRole = ref('')
const copyPermSaving = ref(false)

function openCopyPermDialog() {
  copyFromRole.value = roles.value.find(r => r.code !== activeRoleCode.value)?.code || ''
  copyPermVisible.value = true
}

async function doCopyPerms() {
  if (!copyFromRole.value || !activeRole.value) return
  copyPermSaving.value = true
  try {
    const fromRole = roles.value.find(r => r.code === copyFromRole.value)
    if (!fromRole) return
    await auth.updateRole(activeRole.value.code, { permissions: fromRole.permissions })
    await loadRoles()
    loadRolePermissions()
    if (authStore.user?.roleCode === activeRole.value.code) {
      await authStore.loadRole()
    }
    await auth.logOperation({ userId: authStore.userId!, username: authStore.username, action: '复制角色权限', targetType: 'Role', detail: `将 "${fromRole.name}" 的权限复制到 "${activeRole.value.name}"` })
    copyPermVisible.value = false
    ElMessage.success('权限已复制')
  } catch (e: any) {
    ElMessage.error(e?.message || '复制失败')
  } finally {
    copyPermSaving.value = false
  }
}

// ─── 日志抽屉 ────────────────────────────────────────────

const logsDrawerVisible = ref(false)
const logs = ref<OperationLog[]>([])
const logsLoading = ref(false)
const logTotal = ref(0)
const logPage = ref(1)
const logPageSize = ref(20)
const logKeyword = ref('')
const logUserId = ref<number | ''>('')
const logDateRange = ref<[number, number] | null>(null)
let logTimer: ReturnType<typeof setTimeout>

function debouncedLoadLogs() {
  clearTimeout(logTimer)
  logTimer = setTimeout(() => { logPage.value = 1; loadLogs() }, 350)
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const result = await auth.getOperationLogs({
      keyword: logKeyword.value || undefined,
      userId: logUserId.value || undefined,
      page: logPage.value,
      pageSize: logPageSize.value,
      startDate: logDateRange.value?.[0],
      endDate: logDateRange.value?.[1] ? logDateRange.value[1] + 86400000 - 1 : undefined,
    })
    logs.value = result.list
    logTotal.value = result.total
  } catch (e: any) {
    ElMessage.error(e?.message || '加载日志失败')
  } finally {
    logsLoading.value = false
  }
}

function openLogsDrawer() {
  logKeyword.value = ''
  logUserId.value = ''
  logDateRange.value = null
  logPage.value = 1
  loadLogs()
  logsDrawerVisible.value = true
}

function exportLogs() {
  if (!logs.value.length) return
  const headers = ['时间', '用户', '操作', '对象类型', '详情']
  const rows = logs.value.map(l => [
    formatTs(l.createdAt),
    l.username,
    l.action,
    l.targetType || '',
    l.detail || '',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `操作日志_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── 工具函数 ────────────────────────────────────────────

function getRoleName(code: string) {
  return roles.value.find(r => r.code === code)?.name || code
}

function formatTs(ts: number) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

// ─── 初始化 ────────────────────────────────────────────

onMounted(async () => {
  await loadRoles()
  await loadUsers()
  if (roles.value.length > 0) {
    activeRoleCode.value = roles.value[0].code
    loadRolePermissions()
  }
  // 加载所有用户（用于日志筛选）
  const r = await auth.getUsers({ pageSize: 1000 })
  allUsers.value = r.list
})
</script>

<style scoped>
.users-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 角色抽屉 */
.role-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.role-actions {
  display: flex;
  gap: 8px;
}

.role-info {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
}

.perm-matrix {
  margin-top: 16px;
}

.perm-matrix-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 12px;
}

.perm-category {
  margin-bottom: 16px;
}

.perm-cat-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.perm-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  padding-left: 20px;
}

.perm-save {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.perm-readonly .perm-category {
  margin-bottom: 12px;
}

.perm-readonly .perm-cat-title {
  font-weight: 500;
  color: #303133;
}

.no-perm {
  color: #c0c4cc;
  font-size: 13px;
}

/* 日志抽屉 */
.logs-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  align-items: center;
}
</style>
