/**
 * 权限检查 - 单元测试
 */
import { describe, it, expect } from 'vitest'
import { hasPermission } from './auth'

describe('权限检查 - hasPermission', () => {
  it('admin 角色（含 *）应通过所有权限检查', () => {
    expect(hasPermission(['*'], 'cashier.sale')).toBe(true)
    expect(hasPermission(['*'], 'user.delete')).toBe(true)
    expect(hasPermission(['*'], 'anything')).toBe(true)
  })

  it('有对应权限码应返回 true', () => {
    const perms = ['cashier.sale', 'cashier.refund', 'product.view']
    expect(hasPermission(perms, 'cashier.sale')).toBe(true)
    expect(hasPermission(perms, 'cashier.refund')).toBe(true)
    expect(hasPermission(perms, 'product.view')).toBe(true)
  })

  it('缺少对应权限码应返回 false', () => {
    const perms = ['cashier.sale', 'cashier.refund']
    expect(hasPermission(perms, 'cashier.void')).toBe(false)
    expect(hasPermission(perms, 'product.edit')).toBe(false)
    expect(hasPermission(perms, 'user.delete')).toBe(false)
  })

  it('空权限数组应返回 false', () => {
    expect(hasPermission([], 'cashier.sale')).toBe(false)
  })

  it('无 role 时应返回 false', () => {
    expect(hasPermission([], 'anything')).toBe(false)
  })
})
