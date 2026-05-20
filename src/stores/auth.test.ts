import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('初始未登录状态', () => {
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.user).toBeNull()
    expect(auth.role).toBeNull()
  })

  it('hasPerm 无角色返回 false', () => {
    const auth = useAuthStore()
    expect(auth.hasPerm('cashier.sale')).toBe(false)
  })

  it('hasPerm 有角色无权限返回 false', () => {
    const auth = useAuthStore()
    // 手动设置角色（不走登录流程）
    auth.role = { permissions: ['product.view'], code: 'test', name: 'Test' } as any
    expect(auth.hasPerm('cashier.sale')).toBe(false)
  })

  it('hasPerm admin 通配符', () => {
    const auth = useAuthStore()
    auth.role = { permissions: ['*'], code: 'admin', name: 'Admin' } as any
    expect(auth.hasPerm('any.permission')).toBe(true)
  })

  it('hasPerm 有权限返回 true', () => {
    const auth = useAuthStore()
    auth.role = { permissions: ['cashier.sale', 'product.view'], code: 'cashier', name: 'Cashier' } as any
    expect(auth.hasPerm('cashier.sale')).toBe(true)
  })

  it('init 恢复状态', async () => {
    // 模拟已保存的登录状态
    localStorage.setItem('retailpos_token', 'local_1_1234567890')
    localStorage.setItem('retailpos_user', JSON.stringify({
      id: 1, username: 'admin', realname: '管理员', roleCode: 'admin',
      passwordHash: '', isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
    }))

    setActivePinia(createPinia())
    const auth = useAuthStore()

    // init 前用户已从 localStorage 恢复
    expect(auth.user).toBeTruthy()
    expect(auth.username).toBe('admin')
  })

  it('permissions 计算属性', () => {
    const auth = useAuthStore()
    expect(auth.permissions).toEqual([])

    auth.role = { permissions: ['a', 'b'], code: 'x', name: 'X' } as any
    expect(auth.permissions).toEqual(['a', 'b'])
  })

  it('userId / username / realname 计算属性', () => {
    const auth = useAuthStore()
    expect(auth.userId).toBeUndefined()
    expect(auth.username).toBe('')
    expect(auth.realname).toBe('')

    auth.user = { id: 42, username: 'testuser', realname: '测试用户', roleCode: 'cashier', passwordHash: '', isActive: true, createdAt: Date.now(), updatedAt: Date.now() }
    expect(auth.userId).toBe(42)
    expect(auth.username).toBe('testuser')
    expect(auth.realname).toBe('测试用户')
  })
})
