import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  await prisma.orders.upsert({
    where: { external_id: 'ord_456' },
    update: {},
    create: {
      external_id: 'ord_456',
      status: 'pending',
    },
  })
  console.log('Upserted order ord_456')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
