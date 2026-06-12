import { Module } from '@nestjs/common'
import { WebhooksModule } from './webhooks/webhooks.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule, WebhooksModule],
})
export class AppModule {}
