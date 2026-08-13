# 杨氏厨房（家庭菜谱小程序）

基于微信原生小程序模板实现的家庭共餐 P0。数据仅通过云函数读写云开发环境 `cloud1-d5geu37vd9a1c956f`，不包含任何演示数据或本地缓存数据层。

## 已实现

- 首页：午餐概览、所有成员可用的「我的点菜」、厨师专属的菜单确认卡片，以及家人点菜意愿。
- 点菜：菜品多选、60 字以内备注、提交后可再次修改。
- 菜谱：按分类筛选、关键词搜索，支持内置封面表情或上传菜品实拍图。
- 确认菜单：厨师可选多道菜，确认后自动写入饮食记录并锁定为已确认状态。
- 家庭：邀请码复制、家庭成员展示与重置演示数据。

## 本地运行

1. 使用微信开发者工具导入本目录。
2. AppID 可先使用测试号或项目现有 AppID。
3. 在云开发控制台的“数据库”中一次性创建 `users`、`families`、`familyMembers`、`dishes`、`mealRequests`、`mealRecords` 六个集合。
4. 在微信开发者工具中右键 `cloudfunctions/familyKitchen`，选择“上传并部署：云端安装依赖”。
5. 点击编译；首次进入创建或加入一个真实家庭，再开始添加菜品与点菜。

## 代码格式化与检查

项目已配置 Prettier、`prettier-plugin-wxml` 与 ESLint，覆盖 JavaScript、JSON、WXML 与 WXSS。

```bash
npm run format        # 自动格式化所有源码
npm run format:check  # 仅检查格式
npm run lint          # ESLint 静态检查
npm run check         # 格式检查 + ESLint
```

WXML 使用与插件兼容的 Prettier 2.8.8，以保证小程序模板可以正确换行和缩进。

## 云开发数据库初始化

`cloudfunctions/familyKitchen` 是数据边界。云函数按当前微信用户解析家庭归属，不信任客户端传入的 `familyId`；只有 `owner` / `chef` 可以确认菜单。

请在发布前通过云开发控制台创建以下集合；集合和索引属于环境初始化，不会在用户请求期间由云函数自动创建：

- `users`：建议索引 `openId`。
- `families`：建议唯一索引 `inviteCode`。
- `familyMembers`：建议复合索引 `familyId + openId`，以及 `openId`。
- `dishes`：建议复合索引 `familyId + createdAt`。
- `mealRequests`：建议复合索引 `familyId + date + meal`，以及 `familyId + openId + date + meal`。
- `mealRecords`：建议复合索引 `familyId + date + meal`，以及 `familyId + confirmedAt`。

数据库权限建议设置为“仅云函数可读写”，所有数据访问均经过云函数的家庭归属与角色校验。

## 菜品图片上传

菜品图片会由 Owner / Chef 在新增或编辑菜谱时直接上传至云存储的 `dish-images/` 路径，并在菜谱列表及随机推荐中展示。个人头像与家庭头像分别使用 `user-avatars/`、`family-avatars/` 路径。请在云开发控制台启用云存储，并配置存储规则允许小程序登录用户上传这些路径；数据库仍建议保持“仅云函数可读写”。更换图片或删除未被点菜、记录引用的菜谱时，系统会自动清理旧图片文件。
