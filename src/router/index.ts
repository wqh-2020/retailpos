import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/cashier',
    },
    {
      path: '/cashier',
      name: 'Cashier',
      component: () => import('@/views/Cashier.vue'),
      meta: { title: '收银台' },
    },
    {
      path: '/products',
      name: 'Products',
      component: () => import('@/views/Products.vue'),
      meta: { title: '商品管理' },
    },
    {
      path: '/orders',
      name: 'Orders',
      component: () => import('@/views/Orders.vue'),
      meta: { title: '流水明细' },
    },
    {
      path: '/reports',
      name: 'Reports',
      component: () => import('@/views/Reports.vue'),
      meta: { title: '报表统计' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { title: '系统设置' },
    },
    {
      path: '/members',
      name: 'Members',
      component: () => import('@/views/Members.vue'),
      meta: { title: '会员管理' },
    },
    {
      path: '/inventory',
      name: 'Inventory',
      component: () => import('@/views/Inventory.vue'),
      meta: { title: '库存管理' },
    },
    {
      path: '/promotions',
      name: 'Promotions',
      component: () => import('@/views/Promotions.vue'),
      meta: { title: '促销管理' },
    },
  ],
})

export default router
