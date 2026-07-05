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
| **Phase 4** | E2E | Playwright 14 用例（完整流程 + 并行隔离）、CLI 集成测试、架构合规修复 | 乐观 UI、独立 browserContext 测试并行隔离 |

### 3.2 为什么用这个顺序？

- **SDD 先行**：先定义数据模型和 API 合约，让 AI 在后续写代码时有明确的类型引用，避免幻觉
- **DDD Mock 先行**：用假数据先出 UI 壳，让前后端并行开发不互相阻塞
- **TDD 聚焦核心**：只对最复杂的 Scheduler 和 AI Client 做 TDD（占 80% bugs 的 20% 代码）
- **E2E 兜底**：用 Playwright 覆盖真实用户路径，发现跨模块集成 bug

---

## 四、测试策略（三层金字塔）

| 层级 | 框架 | 用例数 | 覆盖范围 | 运行命令 |
|------|------|--------|---------|---------|
| 单元测试 | Jest 30 + ts-jest | 28 | AI Client（10）+ Scheduler（18） | `pnpm test` |
| CLI 集成测试 | tsx + fetch + socket.io-client | 10 场景 | 完整 HTTP + WebSocket 生命周期 | `pnpm test:cli` |
| E2E 测试 | Playwright 1.61 | 14 | 前端页面 + 并行隔离 + sanitize | `pnpm test:e2e` |

**CLI 测试覆盖的 10 个场景**：
1. `GET /` 健康检查
2. `GET /api/discussions` 列表
3. `POST /api/discussions` 创建讨论
4. `GET /api/discussions/:id` 详情
5. `POST /api/discussions/:id/generate` AI 生成嘉宾
6. WebSocket 连接 + 启动讨论 + 实时事件验证
7. `DISCUSSION_END` + `SUMMARY` 事件验证
8. `POST /api/discussions/:id/confirm` 状态流转
9. `DELETE /api/participants/:id` 删除嘉宾
10. 错误处理：404/400/重复确认

---

## 五、7 个典型技术难题及解决路径

### 问题 1：Prisma 7 破坏性变更 → 数据库无法连接

| 维度 | 内容 |
|------|------|
| **根因** | Prisma 7 将 datasource URL 从 `schema.prisma` 迁移到 `prisma.config.ts`，SQLite 必须使用 `@prisma/adapter-libsql`，而 AI 的知识截止日期未覆盖此变更 |
| **解决** | 引导 AI 逐条阅读 Prisma 7 官方迁移文档 → 安装适配器 → 创建 `prismaClient.ts` 单例 |
| **面试可讲** | "大模型的 knowledge cutoff 是工程化 AI 开发中最常见的问题源。我的做法是先让 AI 读取最新文档再写代码，而不是依赖训练数据中的 API。" |

### 问题 2：Jest Mock 双引号残留 → 测试全部超时

| 维度 | 内容 |
|------|------|
| **根因** | 事件名从字符串 `'newMessage'` 重构为常量 `WS_EVENT.TRANSCRIPT_APPEND` 时，`replace_all` 只替换了单引号版本，双引号 `"newMessage"` 残留 |
| **解决** | 单测试隔离调试 → 检查源码发现双引号残留 → 第二次 `replace_all` 覆盖所有变体 |
| **面试可讲** | "重构标识符时应使用 IDE 的 Rename Symbol，但在文本环境中则需要精确的匹配模式。" |

### 问题 3：AI 发言「论文式」冗长 → 破坏沉浸感

| 维度 | 内容 |
|------|------|
| **根因** | `decideAction` Prompt 未对输出长度做硬约束，AI 默认倾向全面回答 |
| **解决** | 添加"每次发言控制在 1-2 句口语"约束，输出从 200+ 字压缩到 15-50 字 |
| **面试可讲** | "Prompt 工程的核心不仅是让 AI 说得对，更是让 AI 说得对且说得短。" |

### 问题 4-7

详见 [Workflow_Report.md](Workflow_Report.md) —— Mock 数据未切换 API、monorepo 入口缺失、dotenv 未加载、pnpm 11 allowBuilds 阻塞。

---

## 六、面试官可能追问的问题

### Q1：为什么 Scheduler 用 EventEmitter 而不是 RxJS？

EventEmitter 是 Node.js 原生 API，零依赖，且 Scheduler 的事件模型是简单的发出→监听模式，不需要 RxJS 操作符链。Socket.io 本身基于 EventEmitter，保持一致降低了心智负担。

### Q2：ContextManager 的 transcript 压缩策略？

`MAX_ENTRIES = 20` 截断 + 保留最近发言者上下文。控制 token 成本同时保持讨论连贯性。`detectTopicShift()` 检测话题漂移。

### Q3：如何处理 AI API 调用失败？

三层容错——① AbortController 30s 超时 ② 3 次指数退避重试（1s/2s/4s）③ heuristic 降级（SummaryService 在 AI 不可用时用规则提取发言统计）。

### Q4：多个讨论如何做到完全隔离？

三层隔离——① 后端 `Map<discussionId, DiscussionSession>` ② Socket.io `to(discussionId)` 房间机制 ③ 前端 `DiscussionProvider` React Context。

### Q5：如果要重构，你会改变什么？

① 在 DDD 阶段使用 UI UX Pro Max skill 生成设计系统（因网络原因未能安装）② 加入 pre-start 环境变量自检脚本 ③ Scheduler maxMessages 可配置化。

---

## 七、我对「工程化 AI 开发」的理解

工程化 AI 开发不是"用 Prompt 生成代码"，而是**将 AI 当作一个高性能但需要精确指令的初级工程师**，通过以下机制确保交付质量：

1. **上下文隔离**：每个模块拆分独立 Spec Prompt
2. **验证闭环**：AI 生成 → tsc → jest → playwright → code-review
3. **合约先行**：类型/接口/事件协议先于实现
4. **逐层提交**：每次 commit 只做一件事，可追溯可回滚
5. **纠偏积累**：每个 Prompt 附带"为什么这样写"和"之前出了什么问题"

**最终交付**：25 个 commits、46 个源文件（不含 node_modules）、28 单元测试 + 10 CLI 场景 + 14 E2E 测试、6 份技术文档、100% 作业合规。
