import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const topics = [
  {
    topic: "AI 对齐问题：超级智能的安全边界在哪里？",
    config: JSON.stringify({
      maxParticipants: 6,
      estimatedDuration: 90,
      rounds: 3,
      language: "zh-CN",
    }),
  },
  {
    topic: "新能源经济转型：碳中和路径与产业重构",
    config: JSON.stringify({
      maxParticipants: 5,
      estimatedDuration: 120,
      rounds: 4,
      language: "zh-CN",
    }),
  },
  {
    topic: "量子计算的产业化拐点何时到来？",
    config: JSON.stringify({
      maxParticipants: 4,
      estimatedDuration: 75,
      rounds: 3,
      language: "zh-CN",
    }),
  },
  {
    topic: "人口老龄化危机：延迟退休、银发经济与代际公平",
    config: JSON.stringify({
      maxParticipants: 5,
      estimatedDuration: 90,
      rounds: 3,
      language: "zh-CN",
    }),
  },
  {
    topic: "太空资源开发：国际法规真空与技术伦理困境",
    config: JSON.stringify({
      maxParticipants: 4,
      estimatedDuration: 60,
      rounds: 2,
      language: "zh-CN",
    }),
  },
];

async function main() {
  console.log("Seeding discussion topics...");

  for (const data of topics) {
    const discussion = await prisma.discussion.create({ data });
    console.log(`  ✓ Created: ${discussion.topic}`);
  }

  const count = await prisma.discussion.count();
  console.log(`\nDone. ${count} discussions seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
