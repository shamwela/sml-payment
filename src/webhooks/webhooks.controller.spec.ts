import { Test, TestingModule } from '@nestjs/testing'
import { UnauthorizedException, ConflictException } from '@nestjs/common'
import { WebhooksController } from './webhooks.controller'
import { WebhooksService } from './webhooks.service'

const mockWebhooksService = {
  processWebhook: jest.fn(),
}

describe('WebhooksController', () => {
  let controller: WebhooksController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: WebhooksService, useValue: mockWebhooksService },
      ],
    }).compile()

    controller = module.get<WebhooksController>(WebhooksController)
    jest.clearAllMocks()
    process.env.WEBHOOK_SECRET = 'test-secret'
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('handlePaymentWebhook', () => {
    it('should return success for valid webhook', async () => {
      mockWebhooksService.processWebhook.mockResolvedValue(undefined)

      const result = await controller.handlePaymentWebhook(
        { 'x-webhook-secret': 'test-secret' },
        {
          event_id: 'evt_001',
          event_type: 'payment.success',
          order_id: 'ord_456',
        },
      )

      expect(result).toEqual({ success: true })
    })

    it('should return success for duplicate webhook (ConflictException swallowed)', async () => {
      mockWebhooksService.processWebhook.mockRejectedValue(
        new ConflictException(),
      )

      const result = await controller.handlePaymentWebhook(
        { 'x-webhook-secret': 'test-secret' },
        {
          event_id: 'evt_001',
          event_type: 'payment.success',
          order_id: 'ord_456',
        },
      )

      expect(result).toEqual({ success: true })
    })

    it('should throw UnauthorizedException for missing secret', async () => {
      await expect(
        controller.handlePaymentWebhook(
          {},
          {
            event_id: 'evt_001',
            event_type: 'payment.success',
            order_id: 'ord_456',
          },
        ),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException for invalid secret', async () => {
      await expect(
        controller.handlePaymentWebhook(
          { 'x-webhook-secret': 'wrong-secret' },
          {
            event_id: 'evt_001',
            event_type: 'payment.success',
            order_id: 'ord_456',
          },
        ),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException for invalid payload', async () => {
      await expect(
        controller.handlePaymentWebhook(
          { 'x-webhook-secret': 'test-secret' },
          {
            event_id: 'evt_001',
            event_type: 'invalid.type',
            order_id: 'ord_456',
          },
        ),
      ).rejects.toThrow(UnauthorizedException)
    })
  })
})
