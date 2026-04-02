# MyPassword - 密码管理工具

一个本地优先的桌面密码管理工具，支持 Windows / macOS / Linux。

## 功能特性

- **三栏密码管理界面**：左侧分类、中列条目、右侧详情，便于快速浏览和编辑。
- **详情页快捷操作**：支持复制账号/密码、显示/隐藏密码、编辑、删除。
- **网站图标增强**：自动尝试拉取站点 favicon，本地缓存并在异常时自动回退默认字符图标。
- **锁屏与自动锁定**：支持设置锁屏密码、手动锁定、空闲自动锁定。
- **密码生成器**：可配置长度、字符类型、排除模糊字符、每类至少一个字符。
- **分类 / 标签 / 收藏**：支持按分类管理、标签展示、收藏标记。
- **导入导出**：支持加密备份导入导出，支持 1Password 1PUX / CSV / 1PIF 导入。
- **搜索与过滤**：支持按关键词与分类快速筛选。

## 数据存储位置

应用数据保存在 Electron 的 `userData` 目录下。

- **主数据库**：`passwords.db`
- **favicon 缓存目录**：`favicons/`

代码位置参考：`src/main/database.ts` 中 `app.getPath('userData')` 与 `passwords.db` 组合路径。

常见实际路径示例：

- **Windows**：`C:\Users\<用户名>\AppData\Roaming\MyPassword\passwords.db`
- **macOS**：`~/Library/Application Support/MyPassword/passwords.db`
- **Linux**：`~/.config/MyPassword/passwords.db`

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

从 [Releases](https://github.com/6201/mypassword/releases) 下载适合你系统的安装包。

## 开发

### 环境要求

- Node.js 18+
- npm

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

```text
myPassword/
├── src/
│   ├── main/                        # Electron 主进程
│   │   ├── index.ts                 # IPC / 主进程逻辑
│   │   ├── database.ts              # 数据库操作
│   │   ├── crypto.ts                # 加密模块
│   │   ├── password-generator.ts    # 密码生成器
│   │   ├── onepassword-importer.ts  # 1Password 导入
│   │   └── preload.ts               # 预加载脚本
│   └── renderer/                    # React 渲染进程
│       └── src/
│           ├── App.tsx
│           └── components/
│               ├── CategoryNav.tsx
│               ├── PasswordList.tsx
│               ├── PasswordDetail.tsx
│               ├── PasswordForm.tsx
│               ├── PasswordGenerator.tsx
│               ├── SearchBar.tsx
│               └── ExportImportModal.tsx
├── resources/                       # 图标等资源
├── package.json
└── README.md
```

## 安全性

- 使用 PBKDF2 派生密钥（100,000 次迭代）
- 使用 AES-256-GCM 加密导出备份数据
- 剪贴板复制内容 30 秒后自动清空
- 支持应用锁屏密码和自动锁定

## 从 1Password 导入

1. 在 1Password 中导出 1PUX、CSV 或 1PIF 文件。
2. 在 MyPassword 中点击“备份与恢复”并选择“导入”。
3. 选择文件并确认导入结果。

## 数据备份与恢复

### 导出（备份）

1. 点击右上角“备份与恢复”按钮。
2. 选择“导出数据”。
3. 设置并确认加密密码。
4. 选择导出位置并保存。

### 导入（恢复）

1. 点击右上角“备份与恢复”按钮。
2. 选择“导入数据”。
3. 输入备份加密密码。
4. 选择冲突处理策略：跳过 / 覆盖 / 重命名。
5. 选择备份文件并完成导入。

## GitHub Release 发布（维护者）

### 版本与 Tag 约定

- `package.json` 中的版本使用 `X.Y.Z`。
- Git tag 使用 `vX.Y.Z`，并且必须与 `package.json.version` 一致。

### 手动发布（本地）

1. 更新 `package.json` 版本号并提交代码。
2. 打包（按需选择平台）：

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

3. 检查版本与 tag 一致性：

```bash
# macOS / Linux / Git Bash
RELEASE_TAG=vX.Y.Z npm run release:check-tag

# PowerShell
$env:RELEASE_TAG='vX.Y.Z'; npm run release:check-tag

# cmd.exe
set RELEASE_TAG=vX.Y.Z && npm run release:check-tag
```

4. 创建 GitHub 草稿 Release 并上传 `release/` 下产物：

```bash
# macOS / Linux / Git Bash
RELEASE_TAG=vX.Y.Z npm run release:publish:draft

# PowerShell
$env:RELEASE_TAG='vX.Y.Z'; npm run release:publish:draft

# cmd.exe
set RELEASE_TAG=vX.Y.Z && npm run release:publish:draft
```

5. 在 GitHub Release 页面确认资产与说明后，手动点击 Publish。

### 自动发布（CI）

- 推送 `v*` tag 会触发 `.github/workflows/release.yml`。
- Workflow 会在 Windows/macOS/Linux 分别打包并汇总产物。
- 最终自动创建或更新同名 **draft release**（不会直接公开发布）。

### 必需凭据

- 本地手动发布：需要 `gh auth login` 或设置 `GH_TOKEN`。
- GitHub Actions 发布：使用内置 `GITHUB_TOKEN`（workflow 已配置 `contents: write`）。

## License

ISC

