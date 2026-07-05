/* ═══════════════════════════════════════════════════════
   Studio Mock Data
   ═══════════════════════════════════════════════════════ */

export type IndicatorStatus = "speaking" | "listening" | "idle";

export interface PanelistInfo {
  id: string;
  name: string;
  title: string;
  stance: string;
  colorIndex: number;
  color?: string;
  status: IndicatorStatus;
  thinkingBubble: string;
}

export interface TranscriptLine {
  id: string;
  speakerName: string;
  speakerTitle: string;
  colorIndex: number;
  color?: string;
  content: string;
  timestamp: string;
}

export interface ConsensusEntry {
  id: string;
  content: string;
}

export interface DivergenceEntry {
  id: string;
  content: string;
}

// ── Current Speaker ───────────────────────────────────

export const mockCurrentSpeaker: PanelistInfo = {
  id: "p-01",
  name: "张维远",
  title: "AI 安全研究员",
  stance: "严格监管，主张渐进式对齐",
  colorIndex: 0,
  status: "speaking",
  thinkingBubble: "当前正在发言...",
};

// ── Panelist Grid ──────────────────────────────────────

export const mockPanelists: PanelistInfo[] = [
  {
    id: "p-01",
    name: "张维远",
    title: "AI 安全研究员",
    stance: "严格监管",
    colorIndex: 0,
    status: "speaking",
    thinkingBubble: "AGI 的安全边界必须通过形式化验证来保证...",
  },
  {
    id: "p-02",
    name: "陈思然",
    title: "科技伦理学者",
    stance: "技术中性",
    colorIndex: 3,
    status: "listening",
    thinkingBubble: "从伦理学角度看，技术本身没有善恶之分...",
  },
  {
    id: "p-03",
    name: "刘启明",
    title: "AI 产品经理",
    stance: "加速迭代",
    colorIndex: 1,
    status: "idle",
    thinkingBubble: "市场反馈才是最好的对齐机制...",
  },
  {
    id: "p-04",
    name: "王若琳",
    title: "政策顾问",
    stance: "立法先行",
    colorIndex: 4,
    status: "listening",
    thinkingBubble: "国际社会需要建立类似核不扩散的条约框架...",
  },
];

// ── Transcript ─────────────────────────────────────────

export const mockTranscript: TranscriptLine[] = [
  {
    id: "t-01",
    speakerName: "张维远",
    speakerTitle: "AI 安全研究员",
    colorIndex: 0,
    content:
      "我认为，当前大语言模型的涌现能力本质上是一种统计幻象。",
    timestamp: "14:03:15",
  },
  {
    id: "t-02",
    speakerName: "刘启明",
    speakerTitle: "AI 产品经理",
    colorIndex: 1,
    content:
      "我不同意张老师的观点。从产品实践来看，RLHF 已经证明是有效的对齐手段。",
    timestamp: "14:04:02",
  },
  {
    id: "t-03",
    speakerName: "陈思然",
    speakerTitle: "科技伦理学者",
    colorIndex: 3,
    content:
      "AI 对齐不仅是技术问题，更是社会契约问题。谁来定义'对齐'的目标函数？",
    timestamp: "14:05:30",
  },
  {
    id: "t-04",
    speakerName: "王若琳",
    speakerTitle: "政策顾问",
    colorIndex: 4,
    content:
      "我建议参考 GDPR 的经验，先建立一个轻量级的监管沙盒框架。",
    timestamp: "14:06:48",
  },
  {
    id: "t-05",
    speakerName: "张维远",
    speakerTitle: "AI 安全研究员",
    colorIndex: 0,
    content:
      "我们需要一种'自动化监管'机制，用 AI 来审计 AI。",
    timestamp: "14:08:12",
  },
];

// ── Consensus / Divergence ─────────────────────────────

export const mockConsensus: ConsensusEntry[] = [
  { id: "c-01", content: "AI 对齐需要技术手段与制度建设双管齐下" },
  { id: "c-02", content: "监管沙盒是当前阶段最可行的政策工具" },
  { id: "c-03", content: "国际协作框架必要，但短期内难以达成有约束力的协议" },
];

export const mockDivergence: DivergenceEntry[] = [
  {
    id: "d-01",
    content:
      "对齐路线分歧：形式化验证 vs RLHF 经验主义，双方未就方法论达成一致",
  },
  {
    id: "d-02",
    content:
      "监管节奏分歧：张、王主张立法先行，刘认为行业自律足够，时机判断差异显著",
  },
];
