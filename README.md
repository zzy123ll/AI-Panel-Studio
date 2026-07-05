# AI Panel Studio

> 基于 AI 的多专家圆桌讨论模拟平台 — 后端 Express + Socket.io，前端 React + Vite，Prisma + SQLite。

---

## 项目结构

```
ai-panel-studio/
├── backend/                  # Node.js 后端
│   ├── prisma/
│   │   ├── schema.prisma     # 数据模型 (5 models, SQLite)
│   │   └── seed.ts           # 种子数据
│   ├── src/
│   │   ├── agents/
│   │   │   └── Scheduler.ts  # 讨论调度引擎 (状态机 + 冲突仲裁)
│   │   ├── contracts/
│   │   │   ├── types.ts      # DTO 类型定义
│   │   │   └── routes.ts     # 路由常量
│   │   ├── infrastructure/
│   │   │   ├── aiClient.ts   # Deepseek API 封装 (重试 + 超时)
│   │   │   └── sleep.ts      # 异步延迟工具
│   │   ├── prompts/          # LLM prompt 模板 (generate/decide/extract)
│   │   ├── services/
│   │   │   └── prismaClient.ts  # Prisma 单例
│   │   ├── __tests__/        # Jest 单元测试
│   │   └── server.ts         # Express + Socket.io 入口
│   └── prisma.config.ts
│
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # 讨论列表
│   │   │   ├── SetupPage.tsx       # 配置新讨论 + 嘉宾预览
│   │   │   ├── StudioPage.tsx      # 实时讨论演播室
│   │   │   └── studio/             # Studio 子组件
│   │   │       ├── PanelistCard.tsx      # 专家卡片 (状态灯 + 动画)
│   │   │       ├── TranscriptList.tsx    # 实时转录列表
│   │   │       └── ConsensusBoard.tsx    # 共识/分歧面板
│   │   ├── services/
│   │   │   ├── api.ts          # 后端 API 客户端
│   │   │   ├── useSocket.ts    # Socket.io React Hook
│   │   │   └── sanitize.ts     # JSON 防泄漏清洗器
│   │   └── styles/
│   │       └── globals.css     # 设计 Token + 全局样式
│   └── tests/e2e/              # Playwright E2E 测试
│       └── full-flow.spec.ts
└── pnpm-workspace.yaml
```

---

## 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | ≥ 20 |
| pnpm | ≥ 11 |
| SQLite | 内嵌，无需安装 |

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repo-url>
cd ai-panel-studio
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制环境变量模板并填入你的 DeepSeek API Key：

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入真实的 API Key
```

> 获取 API Key：[Deepseek 开放平台](https://platform.deepseek.com/)

### 4. 初始化数据库

```bash
# 在项目根目录执行（使用 pnpm workspace 脚本）
pnpm db:setup
```

或手动分步执行：
```bash
cd backend
pnpm db:generate      # 生成 Prisma Client
pnpm db:migrate --name init  # 创建数据库表
pnpm db:seed          # 植入种子数据（5 个话题 + 嘉宾阵容）
```

### 5. 一键启动前后端

```bash
# 在项目根目录执行（同时启动后端 :3001 和前端 :5173）
pnpm dev
```

或分别启动：
```bash
# 终端 1 — 启动后端
pnpm dev:backend     # → http://localhost:3001

# 终端 2 — 启动前端
pnpm dev:frontend    # → http://localhost:5173
```

> **注意**：启动后端需要先完成步骤 3（配置 `.env`），否则 AI 生成阵容等功能不可用。

---

## API 文档

### 基础地址

```
http://localhost:3001/api
```

### 讨论生命周期

| 方法 | 路径 | 说明 | 状态变更 |
|------|------|------|----------|
| `GET` | `/discussions` | 获取所有讨论列表 | — |
| `GET` | `/discussions/:id` | 获取单个讨论详情 (含嘉宾和转录) | — |
| `POST` | `/discussions` | 创建新讨论 | → `DRAFT` |
| `POST` | `/discussions/:id/generate` | AI 生成嘉宾阵容 | → `CONFIRMED` |
| `POST` | `/discussions/:id/start` | 初始化调度器 | → `ONGOING` |

#### 示例

```bash
# 创建讨论
curl -X POST http://localhost:3001/api/discussions \
  -H "Content-Type: application/json" \
  -d '{"topic":"AI 伦理与法律边界"}'

# 生成嘉宾 (需要 DEEPSEEK_API_KEY)
curl -X POST http://localhost:3001/api/discussions/<id>/generate \
  -H "Content-Type: application/json" \
  -d '{"count":4}'

# 初始化调度器
curl -X POST http://localhost:3001/api/discussions/<id>/start
```

### 响应格式

```json
{
  "success": true,
  "data": { ... }
}
```

错误响应：
```json
{
  "success": false,
  "error": "Discussion not found"
}
```

---

## WebSocket 协议

连接地址：`ws://localhost:3001/studio`

### 客户端 → 服务端

| 事件 | 载荷 | 说明 |
|------|------|------|
| `join` | `string (discussionId)` | 加入讨论房间 |
| `client_confirm` | `string (discussionId)` | 确认启动调度器 |
| `client_stop` | `string (discussionId)` | 暂停调度器 |

### 服务端 → 客户端

| 事件 | 载荷 | 说明 |
|------|------|------|
| `history` | `{ discussionId, entries[] }` | 历史转录 (连接时发送) |
| `transcript` | `{ discussionId, speakerId, speakerName, content, intent, timestamp }` | 实时发言 |
| `confirmed` | `{ discussionId, running: true }` | 启动确认 |
| `stopped` | `{ discussionId, running: false }` | 暂停确认 |
| `error` | `{ message }` | 错误信息 |

---

## 运行测试

### 后端单元测试 (Jest)

```bash
cd backend
pnpm test
```

当前覆盖：28 个测试 (aiClient 10 + Scheduler 18)

### 前端 E2E 测试 (Playwright)

```bash
cd frontend
pnpm exec playwright test
```

当前覆盖：15 个测试 (Dashboard → Setup → Studio 完整流程)

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端框架 | Express 5 |
| 实时通信 | Socket.io 4 |
| ORM | Prisma 7 + SQLite (libsql adapter) |
| AI 接口 | Deepseek Chat API (deepseek-chat) |
| 前端框架 | React 19 |
| 构建工具 | Vite 8 |
| 路由 | React Router v7 |
| 样式 | CSS Modules + Custom Properties |
| 单元测试 | Jest 30 + ts-jest (ESM) |
| E2E 测试 | Playwright 1.61 |
| 包管理 | pnpm 11 (monorepo) |

---

## 讨论状态机

```
DRAFT ──→ CONFIRMED ──→ ONGOING ──→ ENDED
          (AI 生成)     (调度器)    (手动结束)
```

## 专家状态机

```
idle ──→ preparing ──→ speaking ──→ idle
           (被选中)     (冲突胜出)
```

冲突仲裁规则：
1. 主持人优先 (host priority)
2. 立场对立度排序 (stance opposition)
3. 平局时取首位候选人

---

## 已知 Bug 修复记录

- ✅ `sanitizeAiText()` — 防止 AI 返回的 JSON 原始大括号泄漏到 UI
- ✅ `PanelistCard.statusLight` — 专家状态灯通过 `@keyframes` 实时脉冲闪烁
- ✅ `useSocket` — 页面导航时自动清理 Socket 监听器 + 房间 leave (useEffect cleanup)

---

## 已完成能力

| 能力 | 说明 |
|------|------|
| 讨论生命周期管理 | DRAFT → CONFIRMED → ONGOING → ENDED 完整状态机，含严格的状态转换校验 |
| AI 嘉宾阵容生成 | 输入话题后，AI 自动生成主持人 + 专家阵容（姓名、头衔、立场、颜色） |
| 多专家自主发言决策 | 每 4 秒一轮调度 — 随机选取 1-2 名专家，AI 独立决定 SPEAK/interject/rebut/WAIT |
| 冲突仲裁 | 主持人优先 → 立场对立度排序 → 平局取首位候选，Fisher-Yates 洗牌保证随机性 |
| 实时转录 | WebSocket 推送每条发言到前端，支持历史回放（加入房间时自动加载） |
| 共识/分歧提取 | 每 5 轮 AI 提炼共识点和分歧点，讨论结束时生成最终总结 |
| 专家状态可视化 | 状态灯脉冲动画（idle/listening/speaking），思考气泡实时更新 |
| 多讨论并行隔离 | 每个讨论独立 Scheduler 实例 + 独立 Socket.io 房间 + 独立前端 Context |
| JSON 防泄漏 | `sanitizeAiText()` 递归剥离 AI 输出的 JSON 大括号，`looksLikeRawJson()` 二次校验 |
| 响应式布局 | CSS Grid 1fr+400px（桌面）/ 单列（< 1024px），Tab 切换转录/共识面板（移动端） |
| AI API 容错 | 3 次指数退避重试（1s/2s/4s），30s AbortController 超时，heuristic 回退 |
| 完整测试覆盖 | Jest 28 单元测试（AI Client + Scheduler）+ Playwright 17 E2E 测试（完整用户流程 + 并行隔离） |

## 后续改进方向

### 短期（MVP+）
- [ ] **用户认证**：添加登录/注册，支持个人讨论历史
- [ ] **讨论模板**：预置常见话题模板（科技、经济、社会），一键创建
- [ ] **消息持久化恢复**：页面刷新后 WebSocket 重连并恢复 Transcript 和状态
- [ ] **嘉宾自定义**：允许用户手动编辑 AI 生成的嘉宾阵容
- [ ] **移动端优化**：PWA 支持，离线缓存

### 中期（产品化）
- [ ] **多种 AI 模型接入**：支持 OpenAI、Claude、通义千问等多模型切换 / 混合使用
- [ ] **讨论回放**：讨论结束后可回放完整过程（时间轴 + 播放控制）
- [ ] **数据导出**：支持 PDF/Word 格式导出讨论报告
- [ ] **讨论对比**：同一话题多次讨论的共识分歧对比分析
- [ ] **i18n 多语言**：界面 + 讨论内容国际化

### 长期（平台化）
- [ ] **自定义 Prompt 模板**：用户可编辑专家角色 Prompt 和主持人规则
- [ ] **讨论质量评分**：AI 自动评估讨论深度、逻辑连贯性、观点多样性
- [ ] **知识图谱构建**：从多场讨论中自动构建观点关联网络
- [ ] **API 开放平台**：提供 RESTful + WebSocket API 供第三方集成
- [ ] **多人协作**：支持多用户同时观看 + 弹幕互动
