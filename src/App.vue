<template>
  <el-container class="app-container">
    <el-aside width="180px" class="sidebar">
      <div class="logo">
        <span class="logo-icon">
          <el-icon size="22"><ShoppingCart /></el-icon>
        </span>
        <span class="logo-text">收银系统</span>
      </div>
      <el-menu
        :default-active="activeRoute"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/cashier">
          <el-icon><ShoppingCart /></el-icon>
          <template #title>收银台</template>
        </el-menu-item>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <template #title>商品管理</template>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><List /></el-icon>
          <template #title>流水明细</template>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><DataLine /></el-icon>
          <template #title>报表统计</template>
        </el-menu-item>
        <el-menu-item index="/members">
          <el-icon><User /></el-icon>
          <template #title>会员管理</template>
        </el-menu-item>
        <el-menu-item index="/inventory">
          <el-icon><Box /></el-icon>
          <template #title>库存管理</template>
        </el-menu-item>
        <el-menu-item index="/promotions">
          <el-icon><Discount /></el-icon>
          <template #title>促销管理</template>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>系统设置</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="app-header">
        <span class="header-title">{{ pageTitle }}</span>
        <div class="header-right">
          <span class="header-time">{{ currentTime }}</span>
          <el-tag type="success" size="small">v1.0.0</el-tag>
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { formatTime } from '@/utils/orderNo'

const route = useRoute()
const currentTime = ref(formatTime(Date.now()))

const activeRoute = computed(() => route.path)
const pageTitle = computed(() => (route.meta?.title as string) ?? '零售收银系统')

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = formatTime(Date.now())
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.app-container {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background: #1d2b3a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.logo-icon {
  color: #409eff;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

:deep(.el-menu-item) {
  color: rgba(255,255,255,0.65);
  height: 48px;
  line-height: 48px;
}

:deep(.el-menu-item:hover),
:deep(.el-menu-item.is-active) {
  background: rgba(64,158,255,0.15);
  color: #409eff;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 50px;
}

.header-title {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-time {
  font-size: 13px;
  color: #909399;
  font-variant-numeric: tabular-nums;
}

.app-main {
  background: #f5f7fa;
  padding: 16px;
  overflow-y: auto;
}
</style>
