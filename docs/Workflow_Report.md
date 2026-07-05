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

### 问题 4：Mock 数据页面从未接入真实 API，导致"启动后无讨论流动过程"

**现象**：项目启动后，Dashboard 显示硬编码的 5 条假数据，Setup 页面只能预览 Mock 嘉宾，Studio 页面初始化时使用 Mock 数据——整个前端是"静态展示层"，没有任何与后端的数据交互。用户点击"启动讨论"后没有实时发言流动。

**根因**：开发流程中，DDD 阶段（Design-Driven Development）用 Mock 数据快速出 UI 壳，但在后续 TDD 和 E2E 阶段，只把 Socket.io 集成"叠加"到了 Mock 数据之上，从未将页面核心数据源从 Mock 切换到 API。这是典型的"API 集成滞后"问题——UI 和接口分别开发，但集成步骤被遗漏。

**解决路径**：
1. DashboardPage：`useState(mockDiscussions)` → `useEffect` + `listDiscussions()` API 调用，添加 loading/error/empty 三种状态处理。
2. SetupPage：从纯展示组件重构为状态机驱动的多阶段流程（`input_topic → creating → generate_panel → generating → panel_ready`），集成 `createDiscussion()` 和 `generatePanel()` API 调用。
3. StudioPage：从 Mock 数据初始化 → `getDiscussion()` API 加载真实 discussion + participants + transcriptEntries，Socket 事件在此基础上做增量更新。
4. PanelistCard：扩展 `PanelistInfo` 类型增加 `color?: string`，支持来自 API 的 hex 色值。

**教训**：Mock 数据是双刃剑——它让 UI 开发不被后端阻塞，但必须在 API Ready 后第一时间切换到真实数据源。应在 DDD 阶段的 Mock 组件中预留 `useEffect` + API 调用的注释占位符，作为后续集成的"契约标记"。

### 问题 5：根目录缺少 package.json 和 workspace 配置，项目无法一键启动

**现象**：README 写 "pnpm install → pnpm dev" 但根目录没有 `package.json` 也没有 `pnpm-workspace.yaml`。用户不得不分别 cd 到 backend/ 和 frontend/ 手动执行命令。后端没有 `dev` script，只能手动输入 `pnpm exec tsx src/server.ts`。

**根因**：项目初期用 `pnpm init` 分别在 backend/ 和 frontend/ 下初始化，但从未在根目录建立 monorepo 的"入口"。AI 在生成 README 时假设了 monorepo 的标准结构，但该结构并未实际创建。

**解决路径**：
1. 创建根 `package.json`，使用 `concurrently` 编排前后端并行启动。
2. 创建 `pnpm-workspace.yaml` 声明 workspace 包。
3. 后端 `package.json` 添加 `dev: "tsx src/server.ts"` script。
4. 添加 `db:setup` 一键初始化数据库的便捷脚本。
5. 同步更新 README 的启动指令。

**教训**：monorepo 的"入口体验"必须在项目 scaffold 阶段就验证——`git clone → pnpm install → pnpm dev` 是否能一次性跑通。不能假设用户会分别进入子目录手动操作。

### 问题 6：server.ts 未加载 dotenv，环境变量静默失效

**现象**：用户配置了 `.env` 中的 `DEEPSEEK_API_KEY`，但 AI 功能（生成嘉宾阵容、调度发言）始终失败。日志没有明确报错，只是 AI API 调用返回空或超时。

**根因**：`server.ts` 读取 `process.env.DEEPSEEK_API_KEY` 和 `process.env.PORT`，但文件顶部缺少 `import "dotenv/config"`。Node.js 不会自动加载 `.env` 文件，导致所有环境变量为 `undefined`。

**解决路径**：在 `server.ts` 的第一行（所有其他 import 之前）添加 `import "dotenv/config"`。同时创建 `.env.example` 模板文件降低配置门槛。

**教训**：环境变量加载是"基础设施中的基础设施"。应在项目创建时就写一个启动前的"自检脚本"——检查必需的环境变量是否存在、数据库是否可达——而不是等用户在运行时发现 AI 莫名其妙不工作。

### 问题 7：pnpm 11 的 build scripts 审批机制阻断依赖安装

**现象**：`pnpm install` 后，Prisma Client 无法生成、sqlite3 原生模块未编译。原因是 pnpm 11 引入了 `allowBuilds` 机制——默认拒绝所有需要执行构建脚本的依赖（prisma、esbuild、sqlite3 等），需要显式审批。

**根因**：pnpm 11 的安全策略变更，AI 的知识截止日期未覆盖此破坏性变更。项目在 CI/新环境执行 `pnpm install` 后，关键依赖实际未完成安装。

**解决路径**：在 `pnpm-workspace.yaml` 中添加 `allowBuilds` 配置，将 `@prisma/engines`、`esbuild`、`prisma`、`sqlite3`、`unrs-resolver` 设为 `true`。

**教训**：包管理器的安全策略是"静默的破坏者"——安装看起来成功，但功能不工作。应在项目 README 中明确写出所需的 `pnpm approve-builds` 步骤，或直接在 `pnpm-workspace.yaml` 中预配置 `allowBuilds`。

工程化 AI 开发不是"用 Prompt 生成代码"，而是**将 AI 当作一个高性能但需要精确指令的初级工程师**，通过以下机制确保交付质量：

1. **上下文隔离**：每个模块拆分独立的 Spec Prompt，不让 AI 一次性看到 3000 行代码。例如 Scheduler 的仲裁逻辑和前端 UI 组件在不同对话阶段完成。

2. **验证闭环**：AI 生成代码 → 编译检查（`tsc --noEmit`）→ 单元测试（`jest`）→ E2E 测试（`playwright`）→ 人工审查（`code-review` skill）。任何一步失败都立即回退修正。

3. **合约先行**：在任何实现之前先定义类型/接口/事件协议。`contracts/` 目录的存在使得 AI 在写 `server.ts` 和 `useSocket.ts` 时共享同一个 truth source。

4. **逐层提交**：Git 历史是工程化拆解的物证——每次 commit 只做一件事，从 scaffold 到 logic 到 test 到 polish，可追溯、可回滚、可审查。

5. **AI 纠偏记录**：每个 Prompt 模板都附带"为什么这样写"和"之前的版本出了什么问题"，形成可复用的知识积累。
