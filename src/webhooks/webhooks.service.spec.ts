import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { WebhooksService } from './webhooks.service'
import { PrismaService } from '../prisma/prisma.service'

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockPrismaService: any = {
  webhook_events: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  orders: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
}

describe('WebhooksService', () => {
  let service: WebhooksService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile()

    service = module.get<WebhooksService>(WebhooksService)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('processWebhook', () => {
    it('should process payment.success and update order to paid', async () => {
      mockPrismaService.webhook_events.findUnique.mockResolvedValue(null)
      mockPrismaService.orders.findUnique.mockResolvedValue({
        id: 1n,
        external_id: 'ord_456',
        status: 'pending',
      })
      mockPrismaService.orders.update.mockResolvedValue({
        id: 1n,
        external_id: 'ord_456',
        status: 'paid',
      })

      await service.processWebhook({
        event_id: 'evt_001',
        event_type: 'payment.success',
        order_id: 'ord_456',
      })

      expect(mockPrismaService.webhook_events.create).toHaveBeenCalledWith({
        data: { event_id: 'evt_001', event_type: 'payment.success' },
      })
      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { external_id: 'ord_456' },
        data: { status: 'paid' },
      })
    })

    it('should process payment.failed and update order to failed', async () => {
      mockPrismaService.webhook_events.findUnique.mockResolvedValue(null)
      mockPrismaService.orders.findUnique.mockResolvedValue({
        id: 1n,
        external_id: 'ord_456',
        status: 'pending',
      })

      await service.processWebhook({
        event_id: 'evt_002',
        event_type: 'payment.failed',
        order_id: 'ord_456',
      })

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { external_id: 'ord_456' },
        data: { status: 'failed' },
      })
    })

    it('should throw ConflictException for duplicate event_id', async () => {
      mockPrismaService.webhook_events.findUnique.mockResolvedValue({
        id: 1n,
        event_id: 'evt_001',
      })

      await expect(
        service.processWebhook({
          event_id: 'evt_001',
          event_type: 'payment.success',
          order_id: 'ord_456',
        }),
      ).rejects.toThrow(ConflictException)
    })

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaService.webhook_events.findUnique.mockResolvedValue(null)
      mockPrismaService.orders.findUnique.mockResolvedValue(null)

      await expect(
        service.processWebhook({
          event_id: 'evt_003',
          event_type: 'payment.success',
          order_id: 'ord_999',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
