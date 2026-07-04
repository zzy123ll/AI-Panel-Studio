export type DiscussionStatus = "DRAFT" | "CONFIRMED" | "ONGOING" | "ENDED";

export interface DiscussionSummary {
  id: string;
  topic: string;
  status: DiscussionStatus;
  participantCount: number;
  createdAt: string;
}

export const STATUS_COLOR: Record<DiscussionStatus, string> = {
  DRAFT: "#607d8b",
  CONFIRMED: "#66bb6a",
  ONGOING: "#ff7043",
  ENDED: "#9aa0a6",
};

export const STATUS_LABEL: Record<DiscussionStatus, string> = {
  DRAFT: "草稿",
  CONFIRMED: "已确认",
  ONGOING: "进行中",
  ENDED: "已结束",
};

export const mockDiscussions: DiscussionSummary[] = [
  {
    id: "d-001",
    topic: "AI 对齐问题：超级智能的安全边界在哪里？",
    status: "ONGOING",
    participantCount: 6,
    createdAt: "2026-07-04 10:30",
  },
  {
    id: "d-002",
    topic: "新能源经济转型：碳中和路径与产业重构",
    status: "CONFIRMED",
    participantCount: 5,
    createdAt: "2026-07-04 09:15",
  },
  {
    id: "d-003",
    topic: "量子计算的产业化拐点何时到来？",
    status: "DRAFT",
    participantCount: 4,
    createdAt: "2026-07-03 16:00",
  },
  {
    id: "d-004",
    topic: "人口老龄化危机：延迟退休、银发经济与代际公平",
    status: "ENDED",
    participantCount: 5,
    createdAt: "2026-07-02 14:00",
  },
  {
    id: "d-005",
    topic: "太空资源开发：国际法规真空与技术伦理困境",
    status: "DRAFT",
    participantCount: 4,
    createdAt: "2026-07-01 11:45",
  },
];
