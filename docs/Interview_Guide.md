# AI Panel Studio — 面试通关文档

> 本文档面向面试官，整合项目架构、开发过程、技术难点与工程化思考。

---

## 一、项目概述

AI Panel Studio 是一个 **AI 驱动的多专家圆桌讨论模拟平台**。用户输入任意话题后，系统调用 Deepseek 大模型动态生成主持人与专家嘉宾阵容，每位 AI 嘉宾拥有独立的「决策大脑」——根据当前讨论上下文自主决定是否发言（插话/反驳/等待），而非机械轮流。讨论过程中实时提炼共识与分歧，最终由主持人进行自然语言总结。

**技术栈**：Express 5 + Socket.io 4（后端）、React 19 + Vite 8（前端）、Prisma 7 + SQLite（数据库）、Deepseek Chat API（AI 引擎）。

---

## 二、系统架构

### 2.1 整体架构

```
┌─ Frontend (:5173) ─────────────────────────────────┐
│  DashboardPage  SetupPage  StudioPage               │
│  DiscussionProvider (Context + useReducer)           │
│  useSocket (Socket.io hook, 10 WS events)           │
│  api.ts (fetch wrapper, 7 HTTP endpoints)           │
└────────────┬────────────────────────────────────────┘
             │ HTTP REST + WebSocket
┌────────────┴────────────────────────────────────────┐
│  Express 5 (:3001)                                   │
│  ├─ REST API: /api/discussions, /api/participants   │
│  ├─ Socket.io /studio namespace                      │
│  └─ DiscussionSession Store (Map<id, Scheduler>)    │
│                                                      │
│  ┌─ Scheduler (EventEmitter) ─────────────────────┐ │
│  │  ├─ AgentBrain[] (per-expert state machine)     │ │
│  │  ├─ ContextManager (transcript compression)     │ │
│  │  └─ Tick engine (4s interval, Fisher-Yates)    │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ AI Client ────────────────────────────────────┐ │
│  │  ├─ generatePanel(topic, count)                │ │
│  │  ├─ decideAction(context, history)             │ │
│  │  └─ extractConsensus(transcript)               │ │
│  │  (3 retries × exponential backoff, 30s timeout) │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  SQLite (Prisma 7 + @prisma/adapter-libsql)         │
└──────────────────────────────────────────────────────┘
```

### 2.2 数据模型

5 个实体：Discussion → Participant → TranscriptEntry + ConsensusItem + DivergenceItem。详见 [ER_Diagram.mermaid](ER_Diagram.mermaid)。

### 2.3 核心状态机

- **讨论生命周期**：`DRAFT → CONFIRMED → ONGOING → ENDED`
- **专家状态机**：`idle → preparing → raising_hand → speaking → idle`

### 2.4 冲突仲裁

1. 主持人优先 → 2. 立场对立度排序 → 3. 平局取首位（Fisher-Yates 洗牌）

### 2.5 WebSocket 事件协议

10 个标准化事件：TRANSCRIPT_APPEND、AGENT_STATUS_CHANGE、CONSENSUS_NEW、DIVERGENCE_NEW、DISCUSSION_END、SUMMARY、HISTORY、CONFIRMED/STOPPED/ERROR（S→C）；JOIN/LEAVE、CLIENT_CONFIRM/CLIENT_STOP（C→S）。

---

## 三、开发方法论：SDD → DDD → TDD → E2E

| 阶段 | 范式 | 核心产出 |
|------|------|---------|
| Phase 1 | SDD | schema.prisma（5 模型 + 2 枚举）、contracts/（类型 + 路由 + 事件常量） |
| Phase 2 | DDD | 3 页面 + 3 子组件 + 设计 Token + CSS Grid 响应式布局 |
| Phase 3 | TDD | Jest 28 用例（aiClient 10 + Scheduler 18），RED→GREEN 两次迭代 |
| Phase 4 | E2E | Playwright 14 + CLI 集成测试 10 场景 + 架构合规修复 + CI/CD |

---

## 四、测试策略（三层金字塔）

| 层级 | 框架 | 用例数 | 运行命令 |
|------|------|--------|---------|
| 单元测试 | Jest 30 + ts-jest | 28 | `pnpm test` |
| CLI 集成测试 | tsx + socket.io-client | 10 场景 | `pnpm test:cli` |
| E2E 测试 | Playwright 1.61 | 14 | `pnpm test:e2e` |
| CI 自动运行 | GitHub Actions | 3 个 Job | 每次 push 触发 |

---

## 五、7 个典型技术难题

详见 [Workflow_Report.md](Workflow_Report.md)：

1. **Prisma 7 破坏性变更** — datasource URL 迁移 + adapter 适配
2. **Jest Mock 双引号残留** — 测试事件名不匹配导致全超时
3. **AI 发言冗长** — Prompt 约束"1-2 句口语"后从 200+ 字降到 15-50 字
4. **Mock 数据未切换到 API** — 三个页面重写为 API 驱动
5. **monorepo 入口缺失** — 创建根 package.json + workspace 配置
6. **dotenv 未加载** — server.ts 首行添加 `import "dotenv/config"`
7. **Superpowers code-review 发现 6 个跨文件 bug** — 逐一修复并验证

---

## 六、面试官可能追问

**Q: 为什么 Scheduler 用 EventEmitter？**
A: Node.js 原生 API，零依赖，且 Socket.io 本身基于 EventEmitter，保持一致。

**Q: 多讨论如何隔离？**
A: 三层隔离——后端 Map<id, Scheduler> + Socket.io 房间 + 前端 DiscussionProvider Context。

**Q: AI API 失败怎么处理？**
A: 30s 超时 + 3 次指数退避重试（1s/2s/4s）+ heuristic 降级。

**Q: 如果要重构？**
A: ① 使用 UI UX Pro Max 生成设计系统 ② 加入 pre-start 环境变量自检 ③ maxMessages 可配置化。

---

## 七、我对「工程化 AI 开发」的理解

不是"用 Prompt 生成代码"，而是将 AI 当作高性能但需精确指令的初级工程师：

1. **上下文隔离** — 每个模块拆分独立 Spec Prompt
2. **验证闭环** — AI 生成 → tsc → jest → playwright → code-review
3. **合约先行** — 类型/接口/事件协议先于实现
4. **逐层提交** — 每次 commit 只做一件事（26 commits）
5. **纠偏积累** — 每个 Prompt 附带"为什么"和"出过什么问题"

**最终交付**：26 commits、46 源文件、28 单元 + 10 CLI + 14 E2E 测试、CI/CD 自动化、6 份文档、100% 作业合规。
