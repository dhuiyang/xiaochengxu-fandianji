# 杨氏厨房（家庭菜谱小程序）

基于微信原生小程序模板实现的家庭共餐 P0。数据仅通过云函数读写云开发环境 `cloud1-d5geu37vd9a1c956f`，不包含任何演示数据或本地缓存数据层。

## 已实现

- 首页：午餐概览、所有成员可用的「我的点菜」、厨师专属的菜单确认卡片，以及家人点菜意愿。
- 点菜：菜品多选、60 字以内备注、提交后可再次修改。
- 菜谱：按分类筛选、关键词搜索、新增菜品与内置封面表情。
- 确认菜单：厨师可选多道菜，确认后自动写入饮食记录并锁定为已确认状态。
- 家庭：邀请码复制、家庭成员展示与重置演示数据。

## 本地运行

1. 使用微信开发者工具导入本目录。
2. AppID 可先使用测试号或项目现有 AppID。
3. 在微信开发者工具中右键 `cloudfunctions/familyKitchenV2`，选择“上传并部署：云端安装依赖”。
4. 点击编译；首次进入创建或加入一个真实家庭，再开始添加菜品与点菜。

## 代码格式化与检查

项目已配置 Prettier、`prettier-plugin-wxml` 与 ESLint，覆盖 JavaScript、JSON、WXML 与 WXSS。

```bash
npm run format        # 自动格式化所有源码
npm run format:check  # 仅检查格式
npm run lint          # ESLint 静态检查
npm run check         # 格式检查 + ESLint
```

WXML 使用与插件兼容的 Prettier 2.8.8，以保证小程序模板可以正确换行和缩进。

## 云开发接入预留

`cloudfunctions/familyKitchenV2` 是数据边界。云函数按当前微信用户解析家庭归属，不信任客户端传入的 `familyId`；只有 `owner` / `chef` 可以确认菜单。首次调用会创建 `users`、`families`、`familyMembers`、`dishes`、`mealRequests`、`mealRecords` 六个空集合。
