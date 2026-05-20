import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import Login from '@/views/Login.vue'

function mountLogin() {
  return mount(Login, {
    global: {
      plugins: [createPinia(), ElementPlus],
      stubs: {
        'el-icon': true,
        'el-input': { template: '<input v-bind="$attrs" />', inheritAttrs: true },
        'el-form': { template: '<form><slot /></form>' },
        'el-form-item': { template: '<div><slot /></div>' },
        'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: false },
      },
    },
  })
}

describe('Login.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('渲染登录页面', () => {
    const wrapper = mountLogin()
    expect(wrapper.find('.login-page').exists()).toBe(true)
    expect(wrapper.find('.login-card').exists()).toBe(true)
    expect(wrapper.find('.login-title').text()).toBeTruthy()
  })

  it('显示账号和密码输入框', () => {
    const wrapper = mountLogin()
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
  })

  it('显示登录按钮', () => {
    const wrapper = mountLogin()
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    // 按钮应包含"登"字
    expect(buttons.some(b => b.text().includes('登'))).toBe(true)
  })

  it('显示默认账号提示', () => {
    const wrapper = mountLogin()
    expect(wrapper.find('.login-footer').text()).toContain('admin')
  })

  it('初始无错误信息', () => {
    const wrapper = mountLogin()
    expect(wrapper.find('.login-error').exists()).toBe(false)
  })
})
