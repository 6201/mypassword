# MyPassword - 密码管理工具

一个安全、易用的桌面密码管理工具，支持 Windows/macOS/Linux。

## 功能特性

- **密码存储** - 安全加密存储所有密码条目
- **密码生成器** - 自动生成高强度随机密码，可配置长度和复杂度规则
- **自动填充** - 快捷键快速复制密码到剪贴板
- **1Password 导入** - 支持从 1Password 导出的 CSV/1PIF 文件导入
- **数据导出/导入** - 加密备份文件，支持跨设备迁移数据
- **分类管理** - 按分类整理密码条目
- **搜索功能** - 快速查找密码
- **AES-256 加密** - 军用级别加密保护数据安全

## 密码生成器规则

| 选项 | 说明 | 默认值 |
|------|------|--------|
| 长度 | 密码位数 (4-64) | 16 |
| 大写字母 | 包含 A-Z | ✓ |
| 小写字母 | 包含 a-z | ✓ |
| 数字 | 包含 0-9 | ✓ |
| 特殊字符 | 包含 !@#$%^&* 等 | ✓ |
| 排除模糊字符 | 排除 0/O/l/1/I 等 | ✗ |
| 每类至少一个 | 每种类型至少包含一个字符 | ✓ |

## 安装

从 [Releases](https://github.com/your-username/mypassword/releases) 下载适合你系统的安装包：

- **Windows**: `MyPassword Setup 1.0.0.exe` (安装版) 或 `MyPassword 1.0.0.exe` (便携版)
- **macOS**: `MyPassword-1.0.0.dmg`
- **Linux**: `MyPassword-1.0.0.AppImage` 或 `mypassword_1.0.0_amd64.deb`

## 开发

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 运行测试

```bash
npm test
```

### 构建

```bash
npm run build         # 当前平台
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
```

## 技术栈

- **框架**: Electron 41
- **前端**: React 19 + TypeScript
- **数据库**: SQLite (better-sqlite3)
- **加密**: Node.js Crypto (AES-256-GCM + PBKDF2)
- **测试**: Jest

## 项目结构

```
myPassword/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口文件
│   │   ├── database.ts          # 数据库操作
│   │   ├── crypto.ts            # 加密模块
│   │   ├── password-generator.ts # 密码生成器
│   │   ├── onepassword-importer.ts # 1Password 导入
│   │   └── preload.ts           # 预加载脚本
│   └── renderer/                # React 渲染进程
│       ├── index.html
│       ├── src/
│       │   ├── App.tsx
│       │   ├── index.tsx
│       │   └── components/
│       │       ├── PasswordList.tsx
│       │       ├── PasswordForm.tsx
│       │       ├── PasswordGenerator.tsx
│       │       ├── SearchBar.tsx
│       │       └── CategoryNav.tsx
├── resources/                   # 图标等资源
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 安全性

- 使用 PBKDF2 从主密码派生加密密钥（100,000 次迭代）
- 使用 AES-256-GCM 加密存储敏感数据
- 每次加密使用随机 IV 确保密文唯一性
- 剪贴板自动清理（30 秒后）

## 从 1Password 导入

1. 在 1Password 中导出数据为 CSV 或 1PIF 格式
2. 在 MyPassword 中选择"导入"功能
3. 选择导出的文件
4. 确认导入的数据

## 数据备份与恢复

### 导出数据（备份）

1. 点击右上角的"备份与恢复"按钮（下载图标）
2. 切换到"导出数据"选项卡
3. 设置一个加密密码（至少 4 位）
4. 确认密码
5. 点击"导出备份"，选择保存位置

导出的文件使用 AES-256-GCM 加密，需要密码才能解密导入。

### 导入数据（恢复）

1. 点击右上角的"备份与恢复"按钮
2. 切换到"导入数据"选项卡
3. 输入备份文件的加密密码
4. 选择重复数据处理方式：
   - **跳过重复** - 如果条目已存在，跳过不导入
   - **覆盖重复** - 用备份中的数据覆盖现有条目
   - **重命名** - 为重复条目添加后缀后作为新条目导入
5. 点击"导入备份"，选择备份文件

导入完成后会自动刷新页面显示新数据。

## License

ISC
