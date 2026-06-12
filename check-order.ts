import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const order = await prisma.orders.findUnique({
    where: { external_id: 'ord_456' },
  })
  console.log(order)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
