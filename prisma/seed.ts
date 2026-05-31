import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { username: "manager" },
    update: {},
    create: {
      username: "manager",
      displayName: "Kierownik MVP",
      passwordHash: "replace-in-production",
      role: "manager"
    }
  });

  await prisma.user.upsert({
    where: { username: "planner" },
    update: {},
    create: {
      username: "planner",
      displayName: "Planista MVP",
      passwordHash: "replace-in-production",
      role: "planner"
    }
  });

  await prisma.user.upsert({
    where: { username: "warehouse" },
    update: {},
    create: {
      username: "warehouse",
      displayName: "Magazynier MVP",
      passwordHash: "replace-in-production",
      role: "warehouse"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
