import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { WebhookBody } from './dto/webhook.dto'

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async processWebhook(body: WebhookBody): Promise<void> {
    const existingEvent = await this.prisma.webhook_events.findUnique({
      where: { event_id: body.event_id },
    })

    if (existingEvent) {
      throw new ConflictException('Webhook event already processed')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.webhook_events.create({
        data: {
          event_id: body.event_id,
          event_type: body.event_type,
        },
      })

      const order = await tx.orders.findUnique({
        where: { external_id: body.order_id },
      })

      if (!order) {
        throw new NotFoundException(`Order not found for order_id: ${body.order_id}`)
      }

      const newStatus = body.event_type === 'payment.success' ? 'paid' : 'failed'

      await tx.orders.update({
        where: { external_id: body.order_id },
        data: { status: newStatus },
      })
    })
  }
}
