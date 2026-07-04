export interface GuestInfo {
  name: string;
  title: string;
  stance: string;
  colorIndex: number;
}

export const mockGuests: GuestInfo[] = [
  {
    name: "张维远",
    title: "AI 安全研究员 / 前 OpenAI 工程师",
    stance: "严格监管，主张渐进式对齐",
    colorIndex: 0,
  },
  {
    name: "陈思然",
    title: "科技伦理学者 / 清华大学教授",
    stance: "技术中性，关键在于治理框架",
    colorIndex: 3,
  },
  {
    name: "刘启明",
    title: "连续创业者 / AI Native 产品经理",
    stance: "加速迭代，市场会自行纠错",
    colorIndex: 1,
  },
  {
    name: "王若琳",
    title: "政策顾问 / 前工信部智库成员",
    stance: "立法先行，建立国际协作标准",
    colorIndex: 4,
  },
];
