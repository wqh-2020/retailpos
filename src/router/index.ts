import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/cashier',
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/cashier',
      name: 'Cashier',
      component: () => import('@/views/Cashier.vue'),
      meta: { title: '收银台', permission: 'cashier.sale' },
    },
    {
      path: '/products',
      name: 'Products',
      component: () => import('@/views/Products.vue'),
      meta: { title: '商品管理', permission: 'product.view' },
    },
    {
      path: '/orders',
      name: 'Orders',
      component: () => import('@/views/Orders.vue'),
      meta: { title: '流水明细', permission: 'order.view' },
    },
    {
      path: '/reports',
      name: 'Reports',
      component: () => import('@/views/Reports.vue'),
      meta: { title: '报表统计', permission: 'stats.view' },
    },
    {
      path: '/members',
      name: 'Members',
      component: () => import('@/views/Members.vue'),
      meta: { title: '会员管理', permission: 'member.view' },
    },
    {
      path: '/inventory',
      name: 'Inventory',
      component: () => import('@/views/Inventory.vue'),
      meta: { title: '库存管理', permission: 'stock.view' },
    },
    {
      path: '/promotions',
      name: 'Promotions',
      component: () => import('@/views/Promotions.vue'),
      meta: { title: '促销管理', permission: 'promotion.view' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { title: '系统设置', permission: 'settings.manage' },
    },
    {
      path: '/users',
      name: 'Users',
      component: () => import('@/views/Users.vue'),
      meta: { title: '用户权限', permission: 'user.view' },
    },
  ],
})

// 路由守卫
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 初始化 auth store（从 localStorage 恢复）
  await auth.init()

  // 白名单：登录页直接放行
  if (to.path === '/login') {
    if (auth.isLoggedIn) {
      return '/cashier'
    }
    return true
  }

  // 其他页面需要登录
  if (!auth.isLoggedIn) {
    return '/login'
  }

  // 权限检查
  const required = to.meta.permission as string | undefined
  if (required && !auth.hasPerm(required)) {
    return '/cashier'
  }

  return true
})

export default router
