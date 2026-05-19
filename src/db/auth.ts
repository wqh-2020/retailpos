/**
 * 认证与权限 - 数据库操作层
 */
import { db, hashPassword, verifyPassword } from './index'
import type { User, Role, LoginLog, OperationLog, PermissionCode } from '@/types'

// ─── 登录 ────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<{ success: true; user: User } | { success: false; reason: string }> {
  // 记录登录日志
  const logEntry: LoginLog = {
    username,
    success: false,
    failReason: '',
    createdAt: Date.now(),
  }

  const user = await db.users.where('username').equals(username).first()
  if (!user) {
    logEntry.failReason = '用户不存在'
    await db.loginLogs.add(logEntry)
    return { success: false, reason: '账号或密码错误' }
  }

  if (!user.isActive) {
    logEntry.failReason = '账号已禁用'
    await db.loginLogs.add(logEntry)
    return { success: false, reason: '账号已被禁用，请联系管理员' }
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    logEntry.failReason = '密码错误'
    await db.loginLogs.add(logEntry)
    return { success: false, reason: '账号或密码错误' }
  }

  // 登录成功：更新最后登录时间
  logEntry.success = true
  logEntry.userId = user.id
  await db.loginLogs.add(logEntry)
  await db.users.update(user.id!, { lastLoginAt: Date.now() })

  return { success: true, user }
}

// ─── 当前用户 + 角色信息 ─────────────────────────────────

export async function getUserWithRole(userId: number): Promise<(User & { role: Role }) | null> {
  const user = await db.users.get(userId)
  if (!user) return null
  const role = await db.roles.where('code').equals(user.roleCode).first()
  if (!role) return null
  return { ...user, role }
}

// ─── 角色 CRUD ───────────────────────────────────────────

export async function getRoles(): Promise<Role[]> {
  return db.roles.orderBy('sortOrder').toArray()
}

export async function getRoleByCode(code: string): Promise<Role | undefined> {
  return db.roles.where('code').equals(code).first()
}

export async function createRole(data: { code: string; name: string; description?: string; permissions?: string[]; sortOrder?: number }): Promise<Role> {
  const role: Role = {
    code: data.code,
    name: data.name,
    description: data.description,
    permissions: data.permissions || [],
    sortOrder: data.sortOrder || 99,
    canDelete: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const id = await db.roles.add(role)
  return { ...role, id }
}

export async function updateRole(code: string, data: Partial<Pick<Role, 'name' | 'description' | 'permissions' | 'sortOrder'>>): Promise<void> {
  const role = await db.roles.where('code').equals(code).first()
  if (!role) throw new Error('角色不存在')
  await db.roles.update(role.id!, { ...data, updatedAt: Date.now() })
}

export async function deleteRole(code: string): Promise<{ ok: boolean; reason?: string }> {
  const role = await db.roles.where('code').equals(code).first()
  if (!role) return { ok: false, reason: '角色不存在' }
  if (!role.canDelete) return { ok: false, reason: '系统内置角色，不可删除' }

  // 检查是否有用户使用此角色
  const usedBy = await db.users.where('roleCode').equals(code).count()
  if (usedBy > 0) return { ok: false, reason: `已有 ${usedBy} 个用户使用此角色，无法删除` }

  await db.roles.delete(role.id!)
  return { ok: true }
}

// ─── 用户 CRUD ───────────────────────────────────────────

export async function getUsers(query?: { keyword?: string; roleCode?: string; isActive?: boolean; page?: number; pageSize?: number }): Promise<{ list: User[]; total: number }> {
  let all = await db.users.toArray()
  all.reverse() // 按创建时间倒序

  let filtered = all
  if (query?.keyword) {
    const kw = query.keyword.toLowerCase()
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(kw) ||
      u.realname.toLowerCase().includes(kw) ||
      (u.phone || '').includes(kw)
    )
  }
  if (query?.roleCode) {
    filtered = filtered.filter(u => u.roleCode === query.roleCode)
  }
  if (query?.isActive !== undefined) {
    filtered = filtered.filter(u => u.isActive === query.isActive)
  }

  const total = filtered.length
  const page = query?.page || 1
  const pageSize = query?.pageSize || 20
  const list = filtered.slice((page - 1) * pageSize, page * pageSize)

  return { list, total }
}

export async function getUserById(id: number): Promise<User | undefined> {
  return db.users.get(id)
}

export async function createUser(data: { username: string; password: string; realname: string; roleCode: string; phone?: string; email?: string; isActive?: boolean }): Promise<User> {
  const exists = await db.users.where('username').equals(data.username).first()
  if (exists) throw new Error('账号已存在')

  const passwordHash = await hashPassword(data.password)
  const user: User = {
    username: data.username,
    passwordHash,
    realname: data.realname,
    roleCode: data.roleCode,
    phone: data.phone,
    email: data.email,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const id = await db.users.add(user)
  return { ...user, id }
}

export async function updateUser(id: number, data: Partial<Pick<User, 'realname' | 'roleCode' | 'phone' | 'email' | 'isActive'>>): Promise<void> {
  await db.users.update(id, { ...data, updatedAt: Date.now() })
}

export async function resetUserPassword(id: number, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword)
  await db.users.update(id, { passwordHash: hash, updatedAt: Date.now() })
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{ ok: boolean; reason?: string }> {
  const user = await db.users.get(userId)
  if (!user) return { ok: false, reason: '用户不存在' }
  const valid = await verifyPassword(oldPassword, user.passwordHash)
  if (!valid) return { ok: false, reason: '原密码错误' }
  const hash = await hashPassword(newPassword)
  await db.users.update(userId, { passwordHash: hash, updatedAt: Date.now() })
  return { ok: true }
}

export async function deleteUser(id: number): Promise<void> {
  await db.users.delete(id)
}

// ─── 登录日志 ────────────────────────────────────────────

export async function getLoginLogs(query?: { keyword?: string; success?: boolean; page?: number; pageSize?: number }): Promise<{ list: LoginLog[]; total: number }> {
  let all = await db.loginLogs.toArray()
  all.reverse() // 倒序

  if (query?.keyword) {
    const kw = query.keyword.toLowerCase()
    all = all.filter(l => l.username.toLowerCase().includes(kw))
  }
  if (query?.success !== undefined) {
    all = all.filter(l => l.success === query.success)
  }

  const total = all.length
  const page = query?.page || 1
  const pageSize = query?.pageSize || 20
  return { list: all.slice((page - 1) * pageSize, page * pageSize), total }
}

// ─── 操作日志 ────────────────────────────────────────────

export async function logOperation(data: { userId: number; username: string; action: string; targetType?: string; targetId?: number; detail?: string }): Promise<void> {
  const log: OperationLog = {
    ...data,
    createdAt: Date.now(),
  }
  await db.operationLogs.add(log)
}

export async function getOperationLogs(query?: { keyword?: string; userId?: number; action?: string; targetType?: string; page?: number; pageSize?: number; startDate?: number; endDate?: number }): Promise<{ list: OperationLog[]; total: number }> {
  let all = await db.operationLogs.toArray()
  all.reverse() // 倒序

  if (query?.keyword) {
    const kw = query.keyword.toLowerCase()
    all = all.filter(l =>
      l.username.toLowerCase().includes(kw) ||
      l.action.toLowerCase().includes(kw) ||
      (l.detail || '').toLowerCase().includes(kw)
    )
  }
  if (query?.userId) {
    all = all.filter(l => l.userId === query.userId)
  }
  if (query?.action) {
    all = all.filter(l => l.action === query.action)
  }
  if (query?.targetType) {
    all = all.filter(l => l.targetType === query.targetType)
  }
  if (query?.startDate) {
    all = all.filter(l => l.createdAt >= query.startDate!)
  }
  if (query?.endDate) {
    all = all.filter(l => l.createdAt <= query.endDate!)
  }

  const total = all.length
  const page = query?.page || 1
  const pageSize = query?.pageSize || 20
  return { list: all.slice((page - 1) * pageSize, page * pageSize), total }
}

// ─── 权限检查 ────────────────────────────────────────────

export function hasPermission(rolePermissions: string[], required: PermissionCode | string): boolean {
  // admin 角色（权限数组包含所有权限）
  if (rolePermissions.includes('*')) return true
  return rolePermissions.includes(required)
}
