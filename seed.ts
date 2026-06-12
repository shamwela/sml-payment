import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  await prisma.orders.create({
    data: {
      external_id: 'ord_456',
      status: 'pending',
    },
  })
  console.log('Inserted order ord_456')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
