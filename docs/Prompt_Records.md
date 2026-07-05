# 核心 Prompt 记录文档（5 版）

本文档记录了引导 AI 开发 AI Panel Studio 的 5 个核心 Prompt，按开发范式分阶段标记。每条 Prompt 附意图说明和纠偏路径。

---

## [SDD 阶段] Prompt #1 — 数据建模与 API 架构生成

**日期**: 2026-07-04  
**文件产出**: `prisma/schema.prisma`, `contracts/types.ts`, `contracts/routes.ts`

**User Prompt（摘要）**:
> 现在进入 SDD 数据建模阶段。请仅关注 Prisma Schema 的定义，不要编写 API 或前端代码。需要 5 个模型：Discussion（聚合根）、Participant（嘉宾）、TranscriptEntry（发言记录）、ConsensusItem（共识）、DivergenceItem（分歧）。所有主键使用 UUID，外键配置 CASCADE 删除，所有外键列添加 @@index。使用 SQLite。定义枚举 DiscussionStatus (DRAFT/CONFIRMED/ONGOING/ENDED) 和 ParticipantRole (HOST/EXPERT)。编写 seed.ts 植入 5 条中文讨论话题。

**意图**: 在写任何代码前，先通过 SDD 驱动精确的数据模型定义。让 AI 聚焦于 Schema 级别，不跳步到 API 或 UI。

**纠偏说明**:
- 遭遇 Prisma 7 破坏性变更：`datasource.url` 不再允许写在 schema 中 → 引导 AI 阅读 Prisma 7 文档后修正为 `prisma.config.ts`
- SQLite JSON 字段问题：AI 最初尝试使用 Prisma JSON 类型，需纠正为 TEXT 存储 + 应用层 JSON.parse
- PrismaClient 无参构造报错 → 添加 `@prisma/adapter-libsql` 适配器

---

## [DDD 阶段] Prompt #2 — 前端设计系统与页面骨架

**日期**: 2026-07-04  
**文件产出**: `globals.css`, `App.tsx`, `DashboardPage`, `SetupPage`, `StudioPage` 及子组件

**User Prompt（摘要）**:
> 基于 DDD 设计，生成前端页面组件。仅实现展示层（Mock 数据），不涉及 API 调用。CSS 变量定义设计 Token（背景色 #0f1117、卡片色 #1a1d27、主持人金色 #f0b429、10 色专家调色板）。全局 reset（overflow:hidden、box-sizing）。Dashboard 页面用 CSS Grid 展示讨论卡片（状态标签颜色映射）。Setup 页面用滑块控制嘉宾人数 + 生成阵容预览。Studio 页面用 CSS Grid (1fr+400px) 布局：左侧主舞台 + 2x2 专家席，右侧转录侧边栏 + 共识/分歧面板。响应式 < 1024px 单列。

**意图**: 先建 UI 壳（Mock 数据），让设计驱动组件层级，避免因后端接口未完成而阻塞前端开发。

**纠偏说明**:
- Vite 8 模板不包含 React：AI 错误假设 `create-vite` 默认带 React → 手动安装 react/react-dom/@vitejs/plugin-react
- React Router v7 兼容性：`Switch` 已移除 → 使用 `Routes` + `Route` + `element` prop
- CSS Module 类型声明缺失 → 创建 `vite-env.d.ts` 添加 `declare module "*.module.css"`

---

## [DDD/TDD 阶段] Prompt #3 — AI Client 封装（TDD RED→GREEN）

**日期**: 2026-07-04  
**文件产出**: `infrastructure/aiClient.ts`, `prompts/*.ts`, `__tests__/aiClient.test.ts`

**User Prompt（摘要）**:
> 在 /backend/src/infrastructure/aiClient.ts 中封装 Deepseek V4 Pro 调用。三个核心函数：generatePanel(topic, count)、decideAction(context, history)、extractConsensus(transcript)。每个函数有独立的 Prompt 模板文件（system + user message 对）。要求：API key 从 process.env.DEEPSEEK_API_KEY 读取、30s AbortController 超时、3 次指数退避重试（1s/2s/4s）、JSON 解析失败时抛出明确错误。先用 Jest 编写测试（RED），mock fetch + sleep，再实现（GREEN），最后 commit。

**意图**: TDD 驱动 AI Client 开发。Prompts 与 API 调用逻辑分离，方便独立调试和版本管理。

**纠偏说明**:
- `verbatimModuleSyntax` 要求 import 加 `.js` 后缀 → 统一添加
- 重试测试超时（>5s）：原因是 sleep 被真实调用 → 将 sleep 提取到独立模块并用 `jest.mock()` 替换
- Mock hoisting 问题：`mockedSleep` 在 import 前引用 → 使用工厂函数模式的 jest.mock

---

## [TDD 阶段] Prompt #4 — Scheduler 调度引擎（TDD RED→GREEN）

**日期**: 2026-07-04  
**文件产出**: `agents/Scheduler.ts`, `agents/ContextManager.ts`, `agents/AgentBrain.ts`, `__tests__/scheduler.test.ts`

**User Prompt（摘要）**:
> 在 /backend/src/agents/Scheduler.ts 中实现调度器。业务规则：维护内存中每个专家的状态机（idle→preparing→speaking）；每 4 秒触发一次 Tick；Tick 内随机选取 1-2 名 idle 专家，将 Transcript 历史 + 话题传入 aiClient.decideAction；根据 intent 处理（interject 生成发言、rebut 反驳上一条）；冲突处理：主持人优先、立场对立度排序。先用 Jest 写 18 个测试（模拟 aiClient 返回不同 intent、断言不连续同一人发言、主持人优先），测试通过后再实现，Commit: "feat(agent): implement scheduler with TDD green"。

**意图**: 核心调度逻辑是项目最复杂的模块，必须 TDD。先定义测试场景（状态流转、冲突仲裁、防重复），再逐条实现。

**纠偏说明**:
- Math.random mock 导致测试不稳定：Fisher-Yates 洗牌难以精确控制 → 使用 `mockReturnValueOnce` 精确控制随机序列
- 事件名重构后测试全部超时：`'newMessage'` 改为 `WS_EVENT.TRANSCRIPT_APPEND` 时遗漏双引号版本 → 双重 replace_all 修复
- 新增 extractConsensus mock 依赖 → 在 jest.mock 中同步添加

---

## [E2E 阶段] Prompt #5 — 全栈集成 + E2E 质量闭环

**日期**: 2026-07-04  
**文件产出**: `server.ts`, `services/api.ts`, `services/useSocket.ts`, `tests/e2e/full-flow.spec.ts`, `tests/e2e/parallel-isolation.spec.ts`

**User Prompt（摘要）**:
> 最后进入 E2E 质量保障阶段。使用 Playwright 在 /frontend/tests/e2e/ 编写完整流程测试。测试场景：首页→新建→输入话题→生成阵容→Studio→等 20s 断言 Transcript 3+ 发言→断言共识/分歧非空→结束讨论→断言总结无 JSON。同时修复：总结区不渲染 JSON 大括号（sanitizeAiText）、专家状态灯脉冲动画、页面切换 Socket 断开。同时补齐 P0-P2 架构差距：SummaryService、标准事件协议、ContextManager/AgentBrain、docs/ 目录、docker-compose.yml。Commit: "test(e2e): full flow coverage and bug fixes"。

**意图**: E2E 闭环——确保全栈联通、质量可验证。Playwright 覆盖真实用户操作路径，自动发现 JSON 泄漏、动画故障等前端 Bug。

**纠偏说明**:
- 结束讨论按钮不出现：`client_confirm` 需要后端 WebSocket 确认 → 改为乐观 UI 更新（点击即设 isRunning=true）
- 状态灯测试选错 DOM 元素：选中 `.card` 而非 `.statusLight` → 修正为 `speakingCard.locator("[class*='statusLight']")`
- 并行隔离测试需要两个独立 browser context → 使用 `browser.newContext()` 创建隔离环境
- 文档合规缺口：补齐 `Workflow_Report.md`（本文）、扩展 Prompt_Records 至 5 版、新增 `API_Reference.md`

---

## 记录版本

| 版本 | 日期 | Prompt # | 阶段 | 变更 |
|------|------|---------|------|------|
| v1 | 2026-07-04 | #1 | SDD | 数据建模 + API 合约 |
| v2 | 2026-07-04 | #2 | DDD | 前端设计系统 + 页面骨架 |
| v3 | 2026-07-04 | #3 | DDD/TDD | AI Client + Prompt 模板 |
| v4 | 2026-07-04 | #4 | TDD | Scheduler 调度引擎 |
| v5 | 2026-07-04 | #5 | E2E | 全栈集成 + 质量闭环 + 合规修复 |
