# 开发过程思路 & 工作流说明

## 一、开发流程总览

本次「AI Panel Studio」全程使用 **Claude Code** 作为唯一开发环境，底层接入 **Deepseek V4 Pro**（deepseek-chat 模型）作为代码生成与推理引擎。开发范式严格遵循 **SDD → DDD → TDD → E2E** 四阶段递进，每个阶段产出的代码均有独立的 Git commit 支撑。

### 阶段划分

| 阶段 | 范式 | 核心动作 | Git Commit 示例 |
|------|------|---------|-----------------|
| Phase 1 | SDD | 数据建模（Prisma 5 实体 + ER 关系）、API 合约定义、路由常量 | `docs/schema`, `docs/api` |
| Phase 2 | DDD | 设计 Token → Layout 骨架 → Dashboard/Setup 页面 → Studio 沉浸式面板 | `ui/theme`, `ui/pages`, `ui/studio` |
| Phase 3 | TDD | AI Client（RED→GREEN，10 测试）→ Scheduler（RED→GREEN，18 测试） | `feat(ai)`, `feat(agent)` |
| Phase 4 | E2E | Express+Socket.io 集成 → Playwright 15 测试 → 架构合规修复 → 并行隔离测试 | `feat(ws)`, `test(e2e)`, `feat(compliance)` |

### Claude Code + Superpowers 的具体使用方式

1. **Skill 调度**：使用 `/code-review` 对每次提交做 8 路并行 Finder + Verifier 审查；使用 `/security-review` 扫描敏感信息泄漏；使用 `Skill(verify)` 验证运行时行为。

2. **Agent 并行探索**：每次大型实现任务前（如 Studio 页面重构），启动 `Agent(Explore)` 做全代码库扫描，避免盲写。

3. **Workflow 编排**：对合规审计（7 模块 × 9 维度），使用 `Agent` 并行验收每个维度，汇总生成结构化报告。

4. **`/compact` 上下文压缩**：在长对话中定期使用，防止 token 溢出导致的上下文丢失和幻觉。

5. **MCP 工具链**：通过 Glob/Grep/Read/Bash 组合完成文件发现、内容搜索、代码阅读、命令执行的完整工具闭环。

## 二、AI 协同中的典型问题与解决路径

### 问题 1：Prisma 7 破坏性变更导致数据库无法连接

**现象**：初始 Schema 中在 `datasource` 块写了 `url` 字段，`prisma generate` 报错；PrismaClient 无参构造也报错要求 `adapter` 或 `accelerateUrl`。

**根因**：Prisma 7 将 datasource URL 从 schema 移至 `prisma.config.ts`，且 SQLite 必须使用 `@prisma/adapter-libsql` 适配器。

**解决路径**：
1. 逐条阅读 Prisma 7 迁移文档，确认 `datasource.url` → `prisma.config.ts` 的变更。
2. 安装 `@prisma/adapter-libsql` + `@libsql/client`。
3. 创建 `prismaClient.ts` 单例，通过 `PrismaLibSql` 适配器初始化。
4. 在 `prisma.config.ts` 中配置 `seed` 命令路径。

**教训**：大模型对框架的 knowledge cutoff 滞后于最新大版本。SDD 阶段应先让 AI 读取框架文档或实际安装验证，再生成 Schema，而非直接生成。

### 问题 2：Jest Mock 时序导致 Scheduler 测试全部超时

**现象**：Scheduler 重构引入 `AgentBrain` 和 `ContextManager` 后，原有 18 个测试 7 个失败，事件监听器未触发。

**根因**：事件名称从字符串 `'newMessage'` 改为常量 `WS_EVENT.TRANSCRIPT_APPEND`。但测试文件中 `"newMessage"`（双引号）和 `'newMessage'`（单引号）两种写法，`replace_all` 仅替换了一种。导致 `.on("newMessage")` 监听器与被 emit 的 `"TRANSCRIPT_APPEND"` 不匹配。

**解决路径**：
1. 通过单测试调试定位到事件未触发。
2. 检查测试源码发现双引号残留。
3. 第二次 `replace_all` 同时覆盖单双引号。
4. 添加 `extractConsensus` 的 mock 避免副作用。

**教训**：重构代码标识符时，应使用 IDE 的"重命名符号"而非文本替换。在 Claude Code 环境中，应提供更精确的替换指令（如"替换所有 .on() 和 .once() 的第一个参数"）。

### 问题 3：AI 发言太过"论文式"冗长

**现象**：初版 `decideAction` Prompt 生成的发言内容长达 3-4 段（200+ 字），破坏了实时讨论的沉浸感。

**根因**：Prompt 未对输出长度做硬约束。AI 默认倾向"全面回答"。

**解决路径**：
1. 在 `decideAction.ts` 的 User Prompt 末尾添加："每次发言控制在 1-2 句口语，自然打断或反驳，禁止长篇大论。"
2. 在 System Prompt 中保留 "Output valid JSON only — no markdown, no preamble"。
3. 经验证，添加约束后输出长度降至 15-50 字。

**教训**：Prompt 工程的核心不是"让 AI 说得对"，而是"让 AI 说得对且说得短"。口语化约束和篇幅限制是圆桌模拟中最重要的 Prompt 设计维度。

## 三、对"工程化 AI 开发"的理解

工程化 AI 开发不是"用 Prompt 生成代码"，而是**将 AI 当作一个高性能但需要精确指令的初级工程师**，通过以下机制确保交付质量：

1. **上下文隔离**：每个模块拆分独立的 Spec Prompt，不让 AI 一次性看到 3000 行代码。例如 Scheduler 的仲裁逻辑和前端 UI 组件在不同对话阶段完成。

2. **验证闭环**：AI 生成代码 → 编译检查（`tsc --noEmit`）→ 单元测试（`jest`）→ E2E 测试（`playwright`）→ 人工审查（`code-review` skill）。任何一步失败都立即回退修正。

3. **合约先行**：在任何实现之前先定义类型/接口/事件协议。`contracts/` 目录的存在使得 AI 在写 `server.ts` 和 `useSocket.ts` 时共享同一个 truth source。

4. **逐层提交**：Git 历史是工程化拆解的物证——每次 commit 只做一件事，从 scaffold 到 logic 到 test 到 polish，可追溯、可回滚、可审查。

5. **AI 纠偏记录**：每个 Prompt 模板都附带"为什么这样写"和"之前的版本出了什么问题"，形成可复用的知识积累。
