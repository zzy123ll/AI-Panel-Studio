import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const seedData = [
  {
    topic: "AI 对齐问题：超级智能的安全边界在哪里？",
    config: JSON.stringify({ maxParticipants: 6, rounds: 3, language: "zh-CN" }),
    panelists: [
      { name: "陈立明", role: "HOST" as const, title: "主持人 · 科技伦理学者", stance: "中立主持，引导各方在技术可行性与伦理约束间寻找平衡", color: "#f0b429" },
      { name: "李教授", role: "EXPERT" as const, title: "AI 安全研究员", stance: "主张严格对齐约束，超级智能的设计必须以人类价值观可验证为前提", color: "#5b9bd5" },
      { name: "王总", role: "EXPERT" as const, title: "AI 企业 CTO", stance: "呼吁务实推进，过度约束会扼杀创新，市场会自然形成安全标准", color: "#ed7d31" },
      { name: "张博士", role: "EXPERT" as const, title: "认知科学实验室主任", stance: "质疑对齐概念本身——人类的价值观并不一致，对齐到'谁'的标准？", color: "#70ad47" },
      { name: "赵律师", role: "EXPERT" as const, title: "科技法律合伙人", stance: "法律框架必须先行，没有责任界定机制的对齐是空中楼阁", color: "#9b59b6" },
      { name: "孙院士", role: "EXPERT" as const, title: "计算机科学教授", stance: "技术乐观派，认为 scaling law 会自然解决对齐问题，过度担忧是杞人忧天", color: "#e74c3c" },
    ],
  },
  {
    topic: "新能源经济转型：碳中和路径与产业重构",
    config: JSON.stringify({ maxParticipants: 5, rounds: 4, language: "zh-CN" }),
    panelists: [
      { name: "周思远", role: "HOST" as const, title: "主持人 · 财经评论员", stance: "中立主持，关注经济可行性与产业落地路径", color: "#f0b429" },
      { name: "刘部长", role: "EXPERT" as const, title: "国家能源政策顾问", stance: "强调顶层设计——碳交易市场扩容和碳税机制是必由之路", color: "#5b9bd5" },
      { name: "马总", role: "EXPERT" as const, title: "光伏龙头企业 CEO", stance: "光伏+储能已实现平价，市场力量足以驱动转型，政府只需扫除政策障碍", color: "#ed7d31" },
      { name: "杨教授", role: "EXPERT" as const, title: "环境经济学教授", stance: "警惕'绿色泡沫'——部分新能源项目过度依赖补贴，长期不可持续", color: "#70ad47" },
      { name: "陈行长", role: "EXPERT" as const, title: "绿色金融事业部负责人", stance: "碳金融工具创新不足，需要更多市场化激励机制引导社会资本参与", color: "#9b59b6" },
    ],
  },
  {
    topic: "量子计算的产业化拐点何时到来？",
    config: JSON.stringify({ maxParticipants: 4, rounds: 3, language: "zh-CN" }),
    panelists: [
      { name: "钱启明", role: "HOST" as const, title: "主持人 · 科技媒体主编", stance: "中立主持，聚焦产业化时间表与商业价值验证", color: "#f0b429" },
      { name: "潘院士", role: "EXPERT" as const, title: "量子信息国家重点实验室主任", stance: "乐观估计 5-8 年内实现量子优势的商业化应用，尤其是在药物研发和密码学领域", color: "#5b9bd5" },
      { name: "任博士", role: "EXPERT" as const, title: "量子计算初创公司 CTO", stance: "冷静派——容错量子计算机至少还需 10 年，NISQ 时代的商业价值被过度夸大", color: "#ed7d31" },
      { name: "黄总", role: "EXPERT" as const, title: "传统半导体企业战略副总裁", stance: "量子不会替代经典计算，混合架构才是未来，产业应聚焦量子-经典协同", color: "#70ad47" },
    ],
  },
  {
    topic: "人口老龄化危机：延迟退休、银发经济与代际公平",
    config: JSON.stringify({ maxParticipants: 5, rounds: 3, language: "zh-CN" }),
    panelists: [
      { name: "郑雅文", role: "HOST" as const, title: "主持人 · 社会政策研究者", stance: "中立主持，关注政策可操作性与代际利益协调", color: "#f0b429" },
      { name: "吴司长", role: "EXPERT" as const, title: "人社部社保研究所主任", stance: "延迟退休是必然选择，养老金精算缺口必须在 2035 年前通过参数改革解决", color: "#5b9bd5" },
      { name: "冯教授", role: "EXPERT" as const, title: "人口学研究所所长", stance: "仅靠延迟退休远远不够——生育鼓励政策失败的根本原因是养育成本社会化不足", color: "#ed7d31" },
      { name: "段总", role: "EXPERT" as const, title: "银发经济产业园运营总监", stance: "老龄化是万亿级产业机遇——智慧养老、老年文旅、适老化改造需求爆发", color: "#70ad47" },
      { name: "徐代表", role: "EXPERT" as const, title: "青年创业者协会会长", stance: "年轻人社保负担已到临界点，代际契约需要重新谈判而非单方面转嫁", color: "#e74c3c" },
    ],
  },
  {
    topic: "太空资源开发：国际法规真空与技术伦理困境",
    config: JSON.stringify({ maxParticipants: 4, rounds: 2, language: "zh-CN" }),
    panelists: [
      { name: "曹宇飞", role: "HOST" as const, title: "主持人 · 国际关系学者", stance: "中立主持，聚焦国际治理机制与技术伦理边界", color: "#f0b429" },
      { name: "沈总工", role: "EXPERT" as const, title: "航天科技集团深空探测总师", stance: "中国应加速建立月球资源开发能力，先到先得的现实不可回避，技术领先即话语权", color: "#5b9bd5" },
      { name: "姜教授", role: "EXPERT" as const, title: "国际空间法研究所副所长", stance: "外层空间条约已严重滞后于商业航天发展，亟需建立资源开发许可与利益分享机制", color: "#70ad47" },
      { name: "韩总", role: "EXPERT" as const, title: "商业航天公司创始人", stance: "开采小行星只是开始——真正的伦理问题是：谁来定义'合理开发'？谁有权禁止？", color: "#ed7d31" },
    ],
  },
];

async function main() {
  console.log("Seeding AI Panel Studio database...\n");

  for (const data of seedData) {
    // Create discussion
    const discussion = await prisma.discussion.create({
      data: { topic: data.topic, config: data.config, status: "DRAFT" },
    });

    // Create panelists (guest lineup)
    for (const p of data.panelists) {
      await prisma.participant.create({
        data: {
          discussion_id: discussion.id,
          name: p.name,
          role: p.role,
          title: p.title,
          stance: p.stance,
          color: p.color,
        },
      });
    }

    console.log(`  ✓ [${discussion.id.slice(0, 8)}] ${discussion.topic}`);
    console.log(`    └ ${data.panelists.length} 位嘉宾已就位`);
  }

  const discussions = await prisma.discussion.count();
  const participants = await prisma.participant.count();
  console.log(`\nDone. ${discussions} discussions, ${participants} participants seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
