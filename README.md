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

在 `backend/` 目录下创建 `.env` 文件：

```bash
# backend/.env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
```

> 获取 API Key：[Deepseek 开放平台](https://platform.deepseek.com/)

### 4. 初始化数据库

```bash
cd backend
pnpm exec prisma generate
pnpm exec prisma migrate dev --name init
pnpm exec tsx prisma/seed.ts
```

### 5. 启动后端

```bash
cd backend
pnpm exec tsx src/server.ts
```

服务运行在 `http://localhost:3001`

### 6. 启动前端

```bash
cd frontend
pnpm dev
```

前端运行在 `http://localhost:5173`

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
- ✅ `useSocket` — 页面导航时自动清理 Socket 监听器 (useEffect cleanup)
- ✅ `StudioPage.handleEnd` — 结束讨论后 `looksLikeRawJson()` 检查总结无 JSON 污染
