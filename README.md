# 零售收银系统 RetailPOS

零售行业离线桌面收银系统，基于 Vue 3 + Electron 开发，打包为 Windows .exe。

## 功能特性

- **收银台**：商品扫码/搜索、购物车管理、混合支付（现金/微信/支付宝/银行卡）、找零计算、小票打印
- **商品管理**：商品 CRUD、分类管理、Excel 批量导入导出、条码生成
- **流水明细**：订单历史查询、退款/作废、Excel 导出
- **报表统计**：销售概览、支付方式占比饼图
- **系统设置**：店铺信息、小票模板、数据备份/恢复

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | 3.5+ | UI 框架 |
| Electron | 29 | 桌面壳 |
| Element Plus | 2.14+ | UI 组件 |
| Dexie.js | 4.x | IndexedDB 本地数据库 |
| ECharts | 6.x | 报表图表 |
| Pinia | 3.x | 状态管理 |
| Vite | 8.x | 构建工具 |

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（同时启动 Vite Dev Server + Electron）
npm run dev

# 构建 Web 产物
npm run build

# 打包 Windows .exe
npm run dist
```

## 数据存储

所有数据存储在本地 IndexedDB，无需网络连接，无数据上云风险。

- 安装版数据目录：`%APPDATA%\retailpos\`
- 支持手动备份导出为 JSON 文件，可在任何时候恢复

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| F1 | 聚焦商品搜索框 |
| F2 | 打开结算弹窗 |
| F3 | 挂单 |
| Ctrl+P | 补打上一张小票 |

## License

MIT
