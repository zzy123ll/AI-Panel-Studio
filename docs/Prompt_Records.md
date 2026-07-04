# Prompt 记录文档

## 1. generatePanel — 角色生成

**文件**: `backend/src/prompts/generatePanel.ts`

**意图**: 基于讨论话题和人数，生成 JSON 格式的嘉宾阵容。每人包含姓名、头衔、立场。

**System Prompt**:
> You are an expert panel builder. Generate a diverse expert panel for the given topic. Output valid JSON only — no markdown, no preamble.

**纠偏说明**:
- 初版 AI 倾向生成冗长介绍文字 → 添加 "no preamble" 硬约束
- 立场分布不均（同质化严重）→ 在 User Prompt 中明确要求 "立场多元，覆盖支持/反对/中立"

---

## 2. decideAction — 发言决策

**文件**: `backend/src/prompts/decideAction.ts`

**意图**: 输入当前讨论上下文与历史，输出 `{intent, content}`，驱动专家发言。

**System Prompt**:
> You are a discussion moderator AI. Decide the next action. Output valid JSON only — no markdown, no preamble.

**纠偏说明**:
- 初版 AI 发言过于冗长（3-4段）→ 在 User Prompt 添加 "1-2句口语" 硬约束
- 所有专家倾向 "附和赞同" → 添加 "自然打断或反驳" 策略引导
- 输出格式不统一 → 固定 {intent: "SPEAK"|"ASK"|"SUMMARIZE"|"END", content: string}

---

## 3. extractConsensus — 共识提炼

**文件**: `backend/src/prompts/extractConsensus.ts`

**意图**: 扫描近期 Transcript，提取最新共识与分歧，结构化输出。

**System Prompt**:
> You are a discussion analyst. Extract consensus and divergences. Output valid JSON only — no markdown, no preamble.

**纠偏说明**:
- 初版无法区分 "表面共识" 和 "实质分歧" → 强调 "找出立场根本对立的点"
- 输出 size 过大 → 限制返回结果数 ≤ 5 条

---

## 记录版本

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-07-04 | 初始三版 Prompt，基础功能可用 |
