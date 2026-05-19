/**
 * 密码哈希 - 单元测试
 */
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './index'

describe('密码哈希', () => {
  it('hashPassword 应返回 64 位十六进制字符串', async () => {
    const hash = await hashPassword('test123')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('相同密码应生成相同哈希（无随机盐）', async () => {
    const h1 = await hashPassword('abc')
    const h2 = await hashPassword('abc')
    expect(h1).toBe(h2)
  })

  it('不同密码应生成不同哈希', async () => {
    const h1 = await hashPassword('pwd1')
    const h2 = await hashPassword('pwd2')
    expect(h1).not.toBe(h2)
  })

  it('verifyPassword 正确密码应返回 true', async () => {
    const password = 'mySecret123'
    const hash = await hashPassword(password)
    const valid = await verifyPassword(password, hash)
    expect(valid).toBe(true)
  })

  it('verifyPassword 错误密码应返回 false', async () => {
    const hash = await hashPassword('correct')
    const valid = await verifyPassword('wrong', hash)
    expect(valid).toBe(false)
  })
})
