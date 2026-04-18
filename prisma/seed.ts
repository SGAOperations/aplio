import { PrismaClient } from './client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  // Add seed data here
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
