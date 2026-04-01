# 密码条目多网址支持设计

## 1. 背景与目标
部分网站会频繁更换域名，单一 `url` 字段不足以满足真实使用场景。目标是在“添加/编辑密码”流程中支持多个网址输入，并在列表展示和搜索中完整生效。

## 2. 范围与非目标
### 范围
- 密码条目支持有序 `urls` 列表（去重）。
- 添加/编辑表单默认 1 个网址输入框，可手动新增/删除。
- 列表页展示全部网址（每个都可点击）。
- 搜索支持命中任意网址。
- 数据库存储升级为 `urls` 字段（JSON 数组）。

### 非目标
- 不做旧库数据迁移兼容（按“新应用”假设处理）。
- 不增加网址健康检查、自动探活、主域名推荐等额外能力。

## 3. 核心决策
1. 存储模型：使用 `passwords.urls TEXT` 保存 JSON 数组，不再使用 `passwords.url`。
2. 列表语义：`urls` 是“有顺序列表”，保留用户输入顺序并去重。
3. 展示策略：密码卡片显示全部网址。
4. 搜索策略：任意网址命中即可返回条目。

## 4. 架构与组件改动
### 4.1 数据库与主进程（src/main）
- `src/main/database.ts`
  - `PasswordEntry` 从 `url?: string` 调整为 `urls?: string[]`。
  - `passwords` 表定义改为 `urls TEXT NOT NULL DEFAULT '[]'`。
  - 新增统一归一化逻辑：
    - 输入可能是字符串数组。
    - 去空白、去重、保持顺序。
    - 最终存储为 JSON 字符串。
  - `addPassword` / `updatePassword` / `importPasswords` / `exportAllData` 全部切换到 `urls`。
  - `searchPasswords` 改为 `title/username/notes/tags + urls` 命中（`urls` 可通过 `LIKE` 进行文本匹配）。

- `src/main/index.ts`
  - IPC 数据透传字段由 `url` 切到 `urls`。
  - 导入导出流程对应 payload 字段同步更新。

- `src/main/preload.ts`
  - 类型声明与桥接签名同步改为 `urls`。

### 4.2 渲染层（src/renderer）
- `src/renderer/src/components/PasswordForm.tsx`
  - 表单状态字段改为 `urls: string[]`。
  - 默认 `['']`。
  - 提供操作：新增网址、删除网址（至少保留 1 个输入框）、更新指定索引值。
  - 提交前做归一化（去空、去重、保序）。

- `src/renderer/src/components/PasswordList.tsx`
  - 渲染 `urls` 列表，逐项显示可点击链接。
  - 无网址时不渲染网址区域。

- `src/renderer/src/App.tsx`
  - 类型从 `url` 切换到 `urls`。
  - 前端本地筛选逻辑增加网址命中。

### 4.3 导入导出与第三方导入
- `src/main/export-import.ts`：导出/导入结构使用 `urls`。
- `src/main/onepassword-importer.ts`：解析结果从 `url` 改为 `urls`（单网址映射为数组首项）。

## 5. 数据流
1. 用户在表单输入多个网址。
2. 表单提交前归一化 `urls`。
3. renderer 通过 IPC 传给 main。
4. main/database 将 `urls` 序列化为 JSON 字符串写库。
5. 读取时反序列化为数组回传 renderer。
6. 列表与搜索基于数组数据展示与匹配。

## 6. 边界与错误处理
- 空网址输入：允许存在输入框空值，但提交时自动过滤。
- 重复网址：提交时去重（大小写按原值保留，比较可按完全相等）。
- 非法 URL：暂不强制校验（保留用户录入自由度，避免误伤内网域名/自定义协议）。
- 输入框删除：保证至少保留一个输入框，避免界面陷入不可编辑状态。

## 7. 测试计划
- `src/main/__tests__/database.test.ts`
  - 添加条目可存多网址。
  - 更新条目可改多网址。
  - 搜索任意网址可命中。
  - 去空/去重逻辑正确。

- `src/main/__tests__/export-import.test.ts`
  - 导出后再导入，`urls` 保持一致。

- `src/main/__tests__/onepassword-importer.test.ts`
  - 单 `url` 输入可正确映射到 `urls[0]`。

- 渲染手工验证
  - 添加页：默认 1 个网址输入框，可增删。
  - 编辑页：可回显多个网址并修改。
  - 列表页：显示多个可点击网址。
  - 搜索：输入任意网址片段可命中条目。

## 8. 实施文件清单
- `src/main/database.ts`
- `src/main/index.ts`
- `src/main/preload.ts`
- `src/main/export-import.ts`
- `src/main/onepassword-importer.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/PasswordForm.tsx`
- `src/renderer/src/components/PasswordList.tsx`
- `src/main/__tests__/database.test.ts`
- `src/main/__tests__/export-import.test.ts`
- `src/main/__tests__/onepassword-importer.test.ts`
