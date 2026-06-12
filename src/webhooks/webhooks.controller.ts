import {
  Controller,
  Post,
  Headers,
  Body,
  UnauthorizedException,
  ConflictException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { WebhooksService } from './webhooks.service'
import { webhookBodySchema, WebhookBody } from './dto/webhook.dto'

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('payment')
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Headers() headers: Record<string, string>,
    @Body() rawBody: unknown,
  ): Promise<{ success: boolean }> {
    const secretHeader = headers['x-webhook-secret']
    if (!secretHeader) {
      throw new UnauthorizedException('Missing x-webhook-secret header')
    }

    const expectedSecret = process.env.WEBHOOK_SECRET
    if (!expectedSecret) {
      throw new UnauthorizedException('Webhook secret is not configured')
    }
    if (secretHeader !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret')
    }

    const bodyValidation = webhookBodySchema.safeParse(rawBody)
    if (!bodyValidation.success) {
      throw new UnauthorizedException('Invalid webhook payload')
    }

    const body = bodyValidation.data as WebhookBody

    try {
      await this.webhooksService.processWebhook(body)
    } catch (error) {
      if (error instanceof ConflictException) {
        return { success: true }
      }
      throw error
    }

    return { success: true }
  }
}
