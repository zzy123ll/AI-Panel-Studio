# AI Panel Studio — 面试通关文档

> 本文档面向面试官，整合项目架构、开发过程、技术难点与工程化思考，便于快速了解你在本项目中解决的问题和展现的能力。

---

## 一、项目概述（30 秒电梯演讲）

AI Panel Studio 是一个**AI 驱动的多专家圆桌讨论模拟平台**。用户输入任意话题后，系统调用 Deepseek 大模型动态生成主持人与专家嘉宾阵容，每位 AI 嘉宾拥有独立的「决策大脑」——根据当前讨论上下文自主决定是否发言（插话/反驳/等待），而非机械轮流。讨论过程中实时提炼共识与分歧，最终由主持人进行自然语言总结。

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

### 2.2 数据模型（5 个实体）

```
Discussion ──o── Participant      [1 个讨论有 N 个嘉宾]
Discussion ──o── TranscriptEntry  [1 个讨论有 N 条发言]
Discussion ──o── ConsensusItem    [1 个讨论产生 N 个共识]
Discussion ──o── DivergenceItem   [1 个讨论产生 N 个分歧]
Participant ──o── TranscriptEntry [1 个嘉宾发表 N 条发言]
```

### 2.3 核心状态机

**讨论生命周期**：`DRAFT → CONFIRMED → ONGOING → ENDED`

**专家状态机**：
```
idle ──→ preparing ──→ raising_hand ──→ speaking ──→ idle
  ↑         (被Tick选中)    (AI返回发言意图)   (冲突仲裁胜出)
  └──────────────────────────────────────────────────┘
```

### 2.4 冲突仲裁规则

每轮 Tick 选取 1-2 名专家调用 AI 决策，若多人同时想发言：
1. **主持人优先**（Host priority）
2. **立场对立度排序**（与上一位发言者立场相反的优先）
3. **平局取首位候选**（Fisher-Yates 洗牌保证随机性）

### 2.5 WebSocket 事件协议（10 个标准化事件）

| 方向 | 事件 | 触发时机 |
|------|------|---------|
| S→C | `TRANSCRIPT_APPEND` | 每次专家发言 |
| S→C | `AGENT_STATUS_CHANGE` | 专家状态变更（idle→speaking→idle） |
| S→C | `CONSENSUS_NEW` | 每 5 轮提炼共识 |
| S→C | `DIVERGENCE_NEW` | 每 5 轮识别分歧 |
| S→C | `DISCUSSION_END` | 讨论结束（手动/自动 12 轮） |
| S→C | `SUMMARY` | AI 生成最终总结 |
| S→C | `HISTORY` | 客户端加入房间时发送历史转录 |
| S→C | `CONFIRMED` / `STOPPED` / `ERROR` | 操作确认/错误 |
| C→S | `JOIN` / `LEAVE` | 加入/离开讨论房间 |
| C→S | `CLIENT_CONFIRM` / `CLIENT_STOP` | 启动/停止调度器 |

---

## 三、开发方法论：SDD → DDD → TDD → E2E

### 3.1 阶段拆解

| 阶段 | 范式 | 核心产出 | 关键决策 |
|------|------|---------|---------|
| **Phase 1** | SDD | `schema.prisma`（5 模型 + 2 枚举）、`contracts/`（类型 + 路由 + 事件常量） | UUID 主键、CASCADE 删除、SQLite TEXT 存 JSON |
| **Phase 2** | DDD | 3 页面 + 3 子组件 + 设计 Token（10 色专家调色板） | CSS Grid 1fr+420px 布局、Mock 数据先行、响应式 < 1024px |
| **Phase 3** | TDD | Jest 28 用例（aiClient 10 + Scheduler 18），RED→GREEN 两次迭代 | sleep 模块独立以支持 jest.mock()；Fisher-Yates 随机序列通过 `mockReturnValueOnce` 精确控制 |
| **Phase 4** | E2E | Playwright 14 用例（完整流程 + 并行隔离）、架构合规修复、文档补齐 | 乐观 UI（点击即设 isRunning）、独立 browserContext 测试并行隔离 |

### 3.2 为什么用这个顺序？

- **SDD 先行**：先定义数据模型和 API 合约，让 AI 在后续写代码时有明确的类型引用，避免幻觉
- **DDD Mock 先行**：用假数据先出 UI 壳，让前后端并行开发不互相阻塞
- **TDD 聚焦核心**：只对最复杂的 Scheduler 和 AI Client 做 TDD（占 80% bugs 的 20% 代码）
- **E2E 兜底**：用 Playwright 覆盖真实用户路径，发现跨模块集成 bug

---

## 四、7 个典型技术难题及解决路径

### 问题 1：Prisma 7 破坏性变更 → 数据库无法连接

| 维度 | 内容 |
|------|------|
| **根因** | Prisma 7 将 datasource URL 从 `schema.prisma` 迁移到 `prisma.config.ts`，SQLite 必须使用 `@prisma/adapter-libsql`，而 AI 的知识截止日期未覆盖此变更 |
| **解决** | 引导 AI 逐条阅读 Prisma 7 官方迁移文档 → 安装适配器 → 创建 `prismaClient.ts` 单例 |
| **面试可讲** | "大模型的 knowledge cutoff 是工程化 AI 开发中最常见的问题源。我的做法是先让 AI 读取最新文档再写代码，而不是依赖训练数据中的 API。" |

### 问题 2：Jest Mock 双引号残留 → 测试全部超时

| 维度 | 内容 |
|------|------|
| **根因** | 事件名从字符串 `'newMessage'` 重构为常量 `WS_EVENT.TRANSCRIPT_APPEND` 时，`replace_all` 只替换了单引号版本，双引号 `"newMessage"` 残留，导致 `.on("newMessage")` 永远等不到 `"TRANSCRIPT_APPEND"` |
| **解决** | 通过单测试隔离调试定位到事件未触发 → 检查源码发现双引号残留 → 第二次 `replace_all` 覆盖所有变体 |
| **面试可讲** | "重构标识符时应使用 IDE 的 Rename Symbol，但在纯文本环境中则需要精确的匹配模式。这次教训让我学会了在重构后立即运行测试做验证闭环。" |

### 问题 3：AI 发言「论文式」冗长 → 破坏沉浸感

| 维度 | 内容 |
|------|------|
| **根因** | `decideAction` Prompt 未对输出长度做硬约束，AI 默认倾向全面回答 |
| **解决** | 添加"每次发言控制在 1-2 句口语，自然打断或反驳，禁止长篇大论"约束，输出从 200+ 字压缩到 15-50 字 |
| **面试可讲** | "Prompt 工程的核心不仅是让 AI 说得对，更是让 AI 说得对且说得短。这种产品化约束是 AI 应用中最容易被忽视的维度。" |

### 问题 4：Mock 数据从未切换到 API → 前端是静态壳

| 维度 | 内容 |
|------|------|
| **根因** | DDD 阶段用 Mock 快速出 UI，但 TDD/E2E 阶段只叠加了 Socket.io 而没有替换数据源 |
| **解决** | 三个页面全部重写为 API 驱动：`useEffect` + 7 个 HTTP 接口 + loading/error/empty 三态 |
| **面试可讲** | "Mock 数据是双刃剑——它让 UI 不被后端阻塞，但必须在 API 就绪后第一时间切换。我的改进是在 Mock 组件中预留 API 调用的注释占位符作为契约标记。" |

### 问题 5：无根 package.json → 项目无法一键启动

| 维度 | 内容 |
|------|------|
| **根因** | 分别在 backend/frontend 下 `pnpm init` 但从未建立 monorepo 入口 |
| **解决** | 创建根 `package.json`（concurrently 编排）、`pnpm-workspace.yaml`（含 allowBuilds）、后端 `dev` script、`.env.example` 模板 |
| **面试可讲** | "monorepo 的入口体验必须在项目 scaffold 阶段就验证——clone→install→dev 能否一次跑通。" |

### 问题 6：dotenv 未加载 → API Key 静默为 undefined

| 维度 | 内容 |
|------|------|
| **根因** | `server.ts` 读取 `process.env` 但顶部缺少 `import "dotenv/config"`，Node.js 不会自动加载 `.env` |
| **解决** | 在 `server.ts` 首行添加 `import "dotenv/config"`，并创建 `.env.example` 降低配置门槛 |
| **面试可讲** | "环境变量是基础设施中的基础设施。理想做法是写一个 pre-start 自检脚本——检查必需环境变量是否存在、数据库是否可达——而不是让用户在运行时发现 AI 莫名不工作。" |

### 问题 7：老代码 Bug —— 6 个跨文件渲染缺陷

| 维度 | 内容 |
|------|------|
| **根因** | Superpowers code-review（8 路 Finder + Verify）发现的 6 个跨文件 bug——Prompt 意图不匹配、stop() 非幂等、DiscussionProvider 未挂载、AGENT_STATUS_CHANGE 时序错误、4 个 WS 回调缺失、Transcript 排序回归 |
| **解决** | 逐一修复并提交，最后验证 Jest 28/28 + Playwright 14/14 |
| **面试可讲** | "Review 是最低成本的 Bug 发现机制。我使用多角度并行审查（正确性、行为移除、跨文件跟踪、代码复用、简化、效率、架构层次、约定合规），每个角度独立找问题再交叉验证。" |

---

## 五、Prompt 工程实践

### 5.1 5 个核心 Prompt 的设计思路

| # | 阶段 | 核心策略 | 关键约束 |
|---|------|---------|---------|
| 1 | SDD | 聚焦 Schema 定义，禁止 AI 写 API/前端代码 | "仅关注 Prisma Schema 的定义，不要编写 API 或前端代码" |
| 2 | DDD | 先建 UI 壳（Mock 数据），设计驱动组件层级 | "仅实现展示层（Mock 数据），不涉及 API 调用" |
| 3 | TDD | TDD 驱动 AI Client，Prompt 模板与调用逻辑分离 | "先用 Jest 编写测试（RED），mock fetch + sleep，再实现（GREEN）" |
| 4 | TDD | 核心调度逻辑用 18 个测试场景驱动实现 | "先写测试（断言不连续同一人发言、主持人优先），测试通过后再实现" |
| 5 | E2E | 全栈联调 + 文档补齐 + Bug 修复 | "Playwright 覆盖真实用户操作路径，自动发现 JSON 泄漏等前端 Bug" |

### 5.2 AI 协作的关键经验

1. **不让 AI 一次性看到 3000 行代码**：每个模块拆分独立 Prompt，分阶段交付
2. **Prompt 先定义约束，再定义功能**：先告诉 AI "不做什么"，再告诉它"做什么"
3. **纠偏记录**：每个 Prompt 模板附带"为什么这样写"和"之前出了什么问题"

---

## 六、测试策略

| 层级 | 框架 | 用例数 | 覆盖范围 |
|------|------|--------|---------|
| 单元测试 | Jest 30 + ts-jest | 28 | AI Client（10 用例：成功/超时/重试/JSON 解析）+ Scheduler（18 用例：状态流转/冲突仲裁/防重复/共识提取） |
| E2E 测试 | Playwright 1.61 | 14 | Dashboard 加载、Setup 创建流程、Studio 渲染、结束总结、导航清理、并行隔离、sanitize 验证 |

**测试原则**：
- sleep 模块独立到单独文件以支持 `jest.mock()`（避免重试测试超时 5s）
- Fisher-Yates 随机序列通过 `mockReturnValueOnce` 精确控制，保证测试确定性
- E2E 测试兼容后端不可用场景（loading/error 状态）

---

## 七、关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 实时通信 | Socket.io 4（非 SSE） | 支持双向事件、房间隔离、自动重连 |
| 数据库 | SQLite + Prisma 7 | 零配置、单文件、满足 MVP 需求 |
| 包管理 | pnpm 11 monorepo | workspace 协议、节省磁盘、严格依赖 |
| ESM | Node16/Next module kind | 未来兼容性、tree-shaking |
| 前端状态 | React Context + useReducer | 轻量、无需 Redux，按 discussionId 隔离 |
| CSS 方案 | CSS Modules + Custom Properties | 无运行时开销、设计 Token 化 |

---

## 八、面试官可能追问的问题

### Q1：为什么 Scheduler 用 EventEmitter 而不是 RxJS/Observable？

**答**：EventEmitter 是 Node.js 原生 API，零依赖，且 Scheduler 的事件模型是简单的 "发出→监听" 模式，不需要 RxJS 的操作符链。Socket.io 本身就是基于 EventEmitter 的，保持一致降低了心智负担。

### Q2：ContextManager 的 transcript 压缩策略？

**答**：`MAX_ENTRIES = 20` 截断 + 保留最近发言者上下文。当 transcript 超过 20 条时，只保留最近 20 条作为 AI 的上下文窗口，既控制了 token 成本，又保持了讨论连贯性。同时 `detectTopicShift()` 检测话题漂移并在必要时重置上下文。

### Q3：如何处理 AI API 调用失败？

**答**：三层容错——① AbortController 30s 超时 ② 3 次指数退避重试（1s/2s/4s）③ heuristic 降级（SummaryService 在 AI 不可用时用规则提取发言统计作为备选总结）。错误不传播到用户界面。

### Q4：多个讨论如何做到完全隔离？

**答**：三层隔离——① 后端 `Map<discussionId, DiscussionSession>`，每个讨论独立的 Scheduler 实例 ② Socket.io 的 `to(discussionId)` 房间机制，事件只推送给加入该房间的客户端 ③ 前端 `DiscussionProvider` React Context，每个路由渲染独立的 Context 实例。

### Q5：为什么要做 Fisher-Yates 洗牌而不是简单的 Math.random() 排序？

**答**：Fisher-Yates 保证均匀分布——每个排列出现概率相等（1/n!），而 `.sort(() => Math.random() - 0.5)` 存在偏差。在专家数量较少（2-6 人）时，均匀随机性对讨论多样性至关重要。

### Q6：如果让你重构这个项目，你会改变什么？

**答**：三点——① 在 DDD 阶段使用 UI UX Pro Max skill 生成设计系统（因网络原因未能安装，改为手动 7 文件 CSS 重构）② 在 `server.ts` 启动时加入环境变量自检 ③ 将 Scheduler 的 maxMessages 设为可配置的 API 参数而非硬编码。另外，对于生产环境，会考虑使用 PostgreSQL 替代 SQLite 以支持更好的并发写入。

---

## 九、总结：我对「工程化 AI 开发」的理解

工程化 AI 开发不是"用 Prompt 生成代码"，而是**将 AI 当作一个高性能但需要精确指令的初级工程师**，通过以下机制确保交付质量：

1. **上下文隔离**：每个模块拆分独立 Spec Prompt，不让 AI 一次性面对巨量代码
2. **验证闭环**：AI 生成 → `tsc --noEmit` → `jest` → `playwright` → `code-review`，任何一步失败立即回退
3. **合约先行**：类型/接口/事件协议先于实现，`contracts/` 目录是前后端的共同 truth source
4. **逐层提交**：每次 commit 只做一件事——scaffold → logic → test → polish，可追溯、可回滚
5. **纠偏积累**：每个 Prompt 附带"为什么这样写"和"之前出了什么问题"，形成可复用知识库

**最终交付**：24 个 commits、75 个源文件、28 个单元测试 + 14 个 E2E 测试、5 份技术文档、100% 作业合规。
